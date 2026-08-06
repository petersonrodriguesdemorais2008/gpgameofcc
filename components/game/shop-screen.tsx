"use client"

import { useState, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import ItemPreview3D, { type Preview3DItem } from "@/components/game/item-preview-3d"
import { useGame } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Package,
  Star,
  Gift,
  Zap,
  Clock,
  Check,
  X,
  LayoutGrid,
  Lock,
  Plus,
} from "lucide-react"
import Image from "next/image"

interface ShopScreenProps {
  onBack: () => void
}

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  currency: "coins" | "premium"
  type: "pack" | "bundle" | "special"
  image: string
  rarity: "common" | "rare" | "epic" | "legendary"
  discount?: number
  limited?: boolean
  timeLeft?: string
  contents?: string[]
}

interface PlaymatShopItem {
  playmatId: string
  name: string
  description: string
  image: string
  gearPrice: number
  gachaPrice: number
}

const SHOP_ITEMS: ShopItem[] = [
  // Featured Bundles
  {
    id: "starter-bundle",
    name: "Pacote Iniciante",
    description: "Perfeito para novos jogadores! Inclui cartas essenciais.",
    price: 500,
    originalPrice: 1000,
    currency: "coins",
    type: "bundle",
    image: "/images/gacha/pack-fsg.png",
    rarity: "rare",
    discount: 50,
    contents: ["10x Packs FSG", "5x Packs ANL", "1000 Moedas Bonus"],
  },
  {
    id: "legendary-chest",
    name: "Bau Lendario",
    description: "Garantia de pelo menos 1 carta UR ou LR!",
    price: 2500,
    currency: "coins",
    type: "special",
    image: "/images/gacha/pack-anl.png",
    rarity: "legendary",
    limited: true,
    timeLeft: "23:45:30",
    contents: ["5x Packs Premium", "1x UR/LR Garantido", "500 FP Bonus"],
  },
  {
    id: "weekly-deal",
    name: "Oferta Semanal",
    description: "Pacote especial com desconto limitado!",
    price: 750,
    originalPrice: 1500,
    currency: "coins",
    type: "bundle",
    image: "/images/gacha/pack-fsg.png",
    rarity: "epic",
    discount: 50,
    limited: true,
    timeLeft: "6d 12h",
    contents: ["15x Packs Sortidos", "2000 Moedas"],
  },
  // Regular Packs
  {
    id: "pack-fsg-5",
    name: "5x Pack FSG",
    description: "5 packs do banner Fundadores da Santa Guerra",
    price: 50,
    currency: "coins",
    type: "pack",
    image: "/images/gacha/pack-fsg.png",
    rarity: "common",
    contents: ["5x Packs FSG (4 cartas cada)"],
  },
  {
    id: "pack-anl-5",
    name: "5x Pack ANL",
    description: "5 packs do banner Ascensao Nordica: Legends",
    price: 50,
    currency: "coins",
    type: "pack",
    image: "/images/gacha/pack-anl.png",
    rarity: "common",
    contents: ["5x Packs ANL (4 cartas cada)"],
  },
  {
    id: "mega-bundle",
    name: "Mega Bundle",
    description: "O melhor custo-beneficio para colecionar!",
    price: 5000,
    originalPrice: 8000,
    currency: "coins",
    type: "bundle",
    image: "/images/gacha/pack-anl.png",
    rarity: "epic",
    discount: 37,
    contents: ["50x Packs Sortidos", "5000 Moedas", "1000 FP", "1x Playmat Exclusivo"],
  },
]

const PLAYMAT_SHOP_ITEMS: PlaymatShopItem[] = [
  {
    playmatId: "playmat-morgana",
    name: "Morgana: Riff Sombrio",
    description: "A melodia de Morgana ecoa em ondas de energia purpura por todo o campo.",
    image: "/images/playmats/morgana_playmat.png",
    gearPrice: 3200,
    gachaPrice: 1500,
  },
  {
    playmatId: "playmat-fehnon",
    name: "Fehnon: Lamina Azul",
    description: "A lamina gelida de Fehnon corta o campo com correntes de energia azul.",
    image: "/images/playmats/fehnon_playmat.png",
    gearPrice: 3200,
    gachaPrice: 1500,
  },
  {
    playmatId: "playmat-arthur",
    name: "Arthur: Vulto das Sombras",
    description: "O misterioso Arthur envolve o campo em um turbilhao de sombras violetas.",
    image: "/images/playmats/arthur_playmat.png",
    gearPrice: 3200,
    gachaPrice: 1500,
  },
  {
    playmatId: "playmat-calem",
    name: "Calem: Luz Celestial",
    description: "Calem e seu guardiao celestial banham o campo em luz divina.",
    image: "/images/playmats/calem_playmat.png",
    gearPrice: 3200,
    gachaPrice: 1500,
  },
]

type TabId = "featured" | "packs" | "bundles" | "playmats"

const TABS: { id: TabId; label: string; icon: typeof Star }[] = [
  { id: "featured", label: "Destaque", icon: Star },
  { id: "packs", label: "Packs", icon: Package },
  { id: "bundles", label: "Bundles", icon: Gift },
  { id: "playmats", label: "Playmats", icon: LayoutGrid },
]

/* Sistema de raridade: cor funcional unica por tier, usada com parcimonia */
const RARITY = {
  legendary: {
    label: "Lendario",
    text: "text-amber-300",
    chip: "bg-amber-400/10 text-amber-300 border-amber-400/25",
    glow: "rgba(232,180,76,0.16)",
    edge: "from-amber-400/60 via-amber-300/20 to-transparent",
  },
  epic: {
    label: "Epico",
    text: "text-violet-300",
    chip: "bg-violet-400/10 text-violet-300 border-violet-400/25",
    glow: "rgba(167,139,250,0.14)",
    edge: "from-violet-400/60 via-violet-300/20 to-transparent",
  },
  rare: {
    label: "Raro",
    text: "text-cyan-300",
    chip: "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
    glow: "rgba(111,217,232,0.12)",
    edge: "from-cyan-400/60 via-cyan-300/20 to-transparent",
  },
  common: {
    label: "Comum",
    text: "text-slate-300",
    chip: "bg-slate-400/10 text-slate-300 border-slate-400/25",
    glow: "rgba(148,163,184,0.08)",
    edge: "from-slate-400/50 via-slate-400/15 to-transparent",
  },
} as const

function WalletChip({
  icon,
  alt,
  value,
  valueClass,
}: {
  icon: string
  alt: string
  value: number
  valueClass: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Image src={icon || "/placeholder.svg"} alt={alt} width={22} height={22} className="w-[22px] h-[22px] object-contain" />
      <span className={`font-semibold text-sm tabular-nums ${valueClass}`}>{value.toLocaleString()}</span>
    </div>
  )
}

export default function ShopScreen({ onBack }: ShopScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, gearCoins, setGearCoins, addGift, ownedPlaymats, unlockPlaymat } = useGame()
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [selectedPlaymat, setSelectedPlaymat] = useState<PlaymatShopItem | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("featured")
  const [preview3D, setPreview3D] = useState<Preview3DItem | null>(null)

  // Long-press (clicar e segurar) para abrir a visualizacao 3D
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressStart = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressStart.current = null
  }, [])

  const longPressHandlers = (item: Preview3DItem) => ({
    onPointerDown: (e: React.PointerEvent) => {
      suppressClick.current = false
      longPressStart.current = { x: e.clientX, y: e.clientY }
      const target = e.currentTarget as HTMLElement
      const pointerId = e.pointerId
      longPressTimer.current = setTimeout(() => {
        suppressClick.current = true
        longPressTimer.current = null
        // Libera a captura implicita (toque) para que a cena 3D receba o arraste
        try {
          if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId)
        } catch {
          // ignora
        }
        setPreview3D(item)
      }, 450)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!longPressStart.current) return
      const dx = e.clientX - longPressStart.current.x
      const dy = e.clientY - longPressStart.current.y
      if (Math.hypot(dx, dy) > 12) cancelLongPress()
    },
    onPointerUp: cancelLongPress,
    onPointerLeave: cancelLongPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  const guardClick = (fn: () => void) => () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    fn()
  }

  const ownsPlaymat = (playmatId: string) => ownedPlaymats.some((p) => p.id === playmatId)

  const handlePurchase = (item: ShopItem) => {
    if (item.currency === "coins" && coins < item.price) return

    setCoins(coins - item.price)

    addGift({
      title: `Compra: ${item.name}`,
      message: `Voce adquiriu ${item.name}! Aproveite suas recompensas.`,
      coinsReward: item.type === "bundle" ? 500 : undefined,
    })

    setPurchaseSuccess(true)
    setTimeout(() => {
      setPurchaseSuccess(false)
      setSelectedItem(null)
    }, 2000)
  }

  const handlePlaymatPurchase = (item: PlaymatShopItem, currency: "gear" | "gacha") => {
    if (ownsPlaymat(item.playmatId)) return
    if (currency === "gear") {
      if (gearCoins < item.gearPrice) return
      setGearCoins((prev) => prev - item.gearPrice)
    } else {
      if (coins < item.gachaPrice) return
      setCoins(coins - item.gachaPrice)
    }

    unlockPlaymat(item.playmatId)

    setPurchaseSuccess(true)
    setTimeout(() => {
      setPurchaseSuccess(false)
      setSelectedPlaymat(null)
    }, 2000)
  }

  const heroItem = SHOP_ITEMS.find((i) => i.id === "legendary-chest")
  const featuredItems = SHOP_ITEMS.filter((i) => (i.limited || i.discount) && i.id !== "legendary-chest")

  const filteredItems = SHOP_ITEMS.filter((item) => {
    if (activeTab === "packs") return item.type === "pack"
    if (activeTab === "bundles") return item.type === "bundle" || item.type === "special"
    return false
  })

  const renderItemCard = (item: ShopItem) => {
    const r = RARITY[item.rarity]
    return (
      <div
        key={item.id}
        onClick={guardClick(() => setSelectedItem(item))}
        {...longPressHandlers({ image: item.image, name: item.name, kind: "pack" })}
        className="group relative rounded-lg overflow-hidden cursor-pointer bg-[#12141f] border border-white/[0.06] hover:border-amber-400/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] shop-shine shop-frame select-none"
        style={{ touchAction: "pan-y" }}
      >
        {/* Fio de raridade no topo */}
        <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r ${r.edge} z-20`} />

        {/* Zona da arte */}
        <div className="relative h-44 shop-texture shop-pedestal flex items-center justify-center overflow-hidden">
          {/* Glow radial da raridade atras do produto */}
          <div
            className="absolute inset-0 transition-opacity duration-300 opacity-70 group-hover:opacity-100"
            style={{
              background: `radial-gradient(ellipse 55% 65% at 50% 58%, ${r.glow} 0%, transparent 70%)`,
            }}
          />

          {/* Badges */}
          <div className="absolute top-3 inset-x-3 z-20 flex items-start justify-between pointer-events-none">
            {item.limited ? (
              <span className="flex items-center gap-1 bg-[#0a0b12]/90 border border-red-400/30 text-red-300 text-[11px] font-semibold px-2 py-1 rounded tabular-nums backdrop-blur-sm">
                <Clock className="w-3 h-3" />
                {item.timeLeft}
              </span>
            ) : (
              <span />
            )}
            {item.discount && (
              <span className="bg-amber-400 text-[#0a0b12] text-[11px] font-bold px-2 py-1 rounded">
                -{item.discount}%
              </span>
            )}
          </div>

          <Image
            src={item.image || "/placeholder.svg"}
            alt={item.name}
            width={110}
            height={154}
            className="relative z-10 w-auto h-32 object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-1"
          />
        </div>

        {/* Corpo */}
        <div className="px-4 pt-3 pb-4 border-t border-white/[0.05]">
          <span className={`text-[10px] font-bold tracking-[0.18em] uppercase ${r.text}`}>{r.label}</span>
          <h3 className="font-serif font-bold text-[15px] text-white leading-snug mt-0.5 text-balance">{item.name}</h3>
          <p className="text-slate-400 text-[13px] leading-relaxed mt-1 line-clamp-2 min-h-[2.6em]">
            {item.description}
          </p>

          {/* Rodape de preco */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-baseline gap-2">
              {item.originalPrice && (
                <span className="text-slate-500 text-xs line-through tabular-nums">
                  {item.originalPrice.toLocaleString()}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Image
                  src="/images/icons/gacha-coin.png"
                  alt="Gacha Coins"
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px]"
                />
                <span className="text-amber-300 font-bold tabular-nums">{item.price.toLocaleString()}</span>
              </span>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
                coins < item.price
                  ? "text-slate-500 bg-white/[0.04]"
                  : "text-[#0a0b12] bg-amber-400/90 group-hover:bg-amber-300"
              }`}
            >
              {coins < item.price ? "Sem saldo" : "Comprar"}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0a0b12]">
      {/* Fundo: vinheta profunda + facho de luz dourado vindo do topo */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(232,180,76,0.06) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 50% 115%, rgba(111,217,232,0.04) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(232,180,76,0.6) 1px, transparent 0)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#0a0b12]/85 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between px-4 h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              onClick={onBack}
              variant="ghost"
              size="icon"
              aria-label={t("back")}
              className="rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-semibold tracking-[0.3em] text-amber-400/70 uppercase">
                Gear Perks
              </span>
              <h1 className="font-serif text-lg font-bold tracking-[0.14em] text-white">MERCADO</h1>
            </div>
          </div>

          {/* Carteira unificada */}
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-full pl-3 pr-1.5 py-1.5 shrink-0">
            <WalletChip icon="/images/gear-coin.png" alt="Gear Coins" value={gearCoins} valueClass="text-slate-100" />
            <div className="w-px h-4 bg-white/10" aria-hidden="true" />
            <WalletChip
              icon="/images/icons/gacha-coin.png"
              alt="Gacha Coins"
              value={coins}
              valueClass="text-amber-300"
            />
            <button
              aria-label="Obter mais moedas"
              className="w-6 h-6 rounded-full bg-amber-400/90 hover:bg-amber-300 text-[#0a0b12] flex items-center justify-center transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Navegacao segmentada */}
        <nav className="max-w-6xl w-full mx-auto px-4 pb-3" aria-label="Categorias da loja">
          <div className="inline-flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-full p-1 overflow-x-auto max-w-full">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? "page" : undefined}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold whitespace-nowrap rounded-full transition-all duration-200 ${
                  activeTab === id
                    ? "bg-amber-400/90 text-[#0a0b12] shadow-[0_2px_12px_rgba(232,180,76,0.3)]"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Conteudo */}
      <main className="flex-1 px-4 sm:px-6 py-6 overflow-y-auto relative z-10 max-w-6xl w-full mx-auto">
        {activeTab === "featured" && (
          <div className="flex flex-col gap-6">
            {/* Vitrine hero */}
            {heroItem && (
              <section
                onClick={guardClick(() => setSelectedItem(heroItem))}
                {...longPressHandlers({ image: heroItem.image, name: heroItem.name, kind: "pack" })}
                className="group relative rounded-xl overflow-hidden cursor-pointer border border-amber-400/20 hover:border-amber-400/45 transition-colors duration-300 shop-shine shop-frame select-none"
                style={{ touchAction: "pan-y" }}
                aria-label={`Oferta em destaque: ${heroItem.name}`}
              >
                <div className="absolute inset-0 bg-[#12141f]" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 60% 90% at 78% 50%, rgba(232,180,76,0.14) 0%, transparent 65%)",
                  }}
                />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

                <div className="relative flex flex-col sm:flex-row items-center gap-6 px-6 sm:px-10 py-8">
                  <div className="flex-1 order-2 sm:order-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-3">
                      <span className="text-[10px] font-bold tracking-[0.3em] text-amber-400 uppercase">
                        Oferta de Destaque
                      </span>
                      {heroItem.timeLeft && (
                        <span className="flex items-center gap-1 text-red-300 text-[11px] font-semibold tabular-nums">
                          <Clock className="w-3 h-3" />
                          {heroItem.timeLeft}
                        </span>
                      )}
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-2 text-balance">
                      {heroItem.name}
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed mt-2 max-w-md text-pretty">
                      {heroItem.description}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-4 mt-5">
                      <span className="flex items-center gap-2">
                        <Image
                          src="/images/icons/gacha-coin.png"
                          alt="Gacha Coins"
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                        <span className="text-amber-300 font-bold text-2xl tabular-nums">
                          {heroItem.price.toLocaleString()}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-[#0a0b12] bg-amber-400 group-hover:bg-amber-300 px-5 py-2.5 rounded transition-colors">
                        Ver Oferta
                      </span>
                    </div>
                  </div>

                  <div className="relative order-1 sm:order-2 shrink-0 shop-pedestal px-8 pb-3">
                    <Image
                      src={heroItem.image || "/placeholder.svg"}
                      alt={heroItem.name}
                      width={160}
                      height={224}
                      className="relative z-10 w-auto h-44 sm:h-52 object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.7)] shop-float"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Demais destaques */}
            <section aria-label="Promocoes ativas">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-serif text-sm font-bold tracking-[0.2em] text-slate-200 uppercase">
                  Promocoes Ativas
                </h2>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredItems.map(renderItemCard)}
              </div>
            </section>
          </div>
        )}

        {(activeTab === "packs" || activeTab === "bundles") && (
          <section aria-label={activeTab === "packs" ? "Packs" : "Bundles"}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-serif text-sm font-bold tracking-[0.2em] text-slate-200 uppercase">
                {activeTab === "packs" ? "Packs de Cartas" : "Bundles e Especiais"}
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredItems.map(renderItemCard)}</div>
          </section>
        )}

        {activeTab === "playmats" && (
          <section aria-label="Playmats">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-serif text-sm font-bold tracking-[0.2em] text-slate-200 uppercase">
                Playmats de Duelo
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <p className="text-slate-400 text-sm mb-5">
              Compra unica. Pague com Gear Coins ou Gacha Coins — o item vai direto para sua conta.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLAYMAT_SHOP_ITEMS.map((item) => {
                const owned = ownsPlaymat(item.playmatId)
                return (
                  <div
                    key={item.playmatId}
                    onClick={guardClick(() => !owned && setSelectedPlaymat(item))}
                    {...longPressHandlers({ image: item.image, name: item.name, kind: "playmat" })}
                    className={`group relative rounded-lg overflow-hidden border bg-[#12141f] transition-all duration-300 shop-frame select-none ${
                      owned
                        ? "border-white/[0.08] cursor-pointer"
                        : "border-white/[0.06] hover:border-amber-400/35 cursor-pointer hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] shop-shine"
                    }`}
                    style={{ touchAction: "pan-y" }}
                  >
                    <div className="relative aspect-[3/2] overflow-hidden">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={`Playmat ${item.name}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className={`object-cover transition-transform duration-700 ${
                          owned ? "saturate-[0.85]" : "group-hover:scale-[1.04]"
                        }`}
                      />
                      {/* Vinheta cinematografica integrando a arte a UI */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#12141f] via-[#12141f]/10 to-transparent" />
                      <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(10,11,18,0.55)]" />

                      {owned && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#0a0b12]/85 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold px-2.5 py-1 rounded backdrop-blur-sm">
                          <Check className="w-3.5 h-3.5" />
                          Adquirido
                        </div>
                      )}

                      <div className="absolute bottom-0 inset-x-0 p-4">
                        <h3 className="font-serif text-white font-bold text-lg leading-tight text-balance">
                          {item.name}
                        </h3>
                        <p className="text-slate-300/75 text-[13px] leading-relaxed mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
                      {owned ? (
                        <span className="text-emerald-300 text-sm font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Ja esta na sua conta
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5">
                              <Image
                                src="/images/gear-coin.png"
                                alt="Gear Coins"
                                width={18}
                                height={18}
                                className="w-[18px] h-[18px] object-contain"
                              />
                              <span className="text-slate-100 font-bold text-sm tabular-nums">
                                {item.gearPrice.toLocaleString()}
                              </span>
                            </span>
                            <span className="text-slate-600 text-[10px] font-bold tracking-widest">OU</span>
                            <span className="flex items-center gap-1.5">
                              <Image
                                src="/images/icons/gacha-coin.png"
                                alt="Gacha Coins"
                                width={18}
                                height={18}
                                className="w-[18px] h-[18px] object-contain"
                              />
                              <span className="text-amber-300 font-bold text-sm tabular-nums">
                                {item.gachaPrice.toLocaleString()}
                              </span>
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-[#0a0b12] bg-amber-400/90 group-hover:bg-amber-300 px-3 py-1.5 rounded transition-colors">
                            Ver oferta
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* Modal de compra (packs/bundles) */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !purchaseSuccess && setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Comprar ${selectedItem.name}`}
        >
          <div
            className="relative w-full max-w-md bg-[#12141f] rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            {purchaseSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-400/25 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-300" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-white mb-2">Compra Realizada!</h3>
                <p className="text-slate-400 leading-relaxed">
                  Verifique sua caixa de presentes para coletar as recompensas.
                </p>
              </div>
            ) : (
              <>
                <div className={`h-px bg-gradient-to-r ${RARITY[selectedItem.rarity].edge}`} />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] transition-colors z-20"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>

                <div className="p-6 pb-0">
                  <div className="relative w-full rounded-lg overflow-hidden mb-5 shop-texture shop-pedestal flex items-center justify-center py-6">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(ellipse 55% 70% at 50% 55%, ${RARITY[selectedItem.rarity].glow} 0%, transparent 70%)`,
                      }}
                    />
                    <Image
                      src={selectedItem.image || "/placeholder.svg"}
                      alt={selectedItem.name}
                      width={160}
                      height={224}
                      className="relative z-10 w-auto h-40 object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.7)]"
                    />
                  </div>

                  <span
                    className={`inline-block text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded border ${RARITY[selectedItem.rarity].chip}`}
                  >
                    {RARITY[selectedItem.rarity].label}
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-white mt-2 mb-1 text-balance">
                    {selectedItem.name}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{selectedItem.description}</p>

                  {selectedItem.contents && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 mb-5">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-amber-400/80 uppercase mb-2">
                        Conteudo do pacote
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {selectedItem.contents.map((content, i) => (
                          <li key={i} className="flex items-center gap-2.5 text-slate-300 text-sm">
                            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                            {content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="p-6 pt-5 bg-[#0a0b12]/60 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400 text-sm">Preco total</span>
                    <div className="flex items-baseline gap-2">
                      {selectedItem.originalPrice && (
                        <span className="text-slate-500 line-through tabular-nums">
                          {selectedItem.originalPrice.toLocaleString()}
                        </span>
                      )}
                      <span className="flex items-center gap-2">
                        <Image
                          src="/images/icons/gacha-coin.png"
                          alt="Gacha Coins"
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                        <span className="text-amber-300 font-bold text-2xl tabular-nums">
                          {selectedItem.price.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handlePurchase(selectedItem)}
                    disabled={coins < selectedItem.price}
                    className="w-full py-6 text-base font-bold bg-amber-400 hover:bg-amber-300 text-[#0a0b12] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {coins < selectedItem.price ? "Moedas Insuficientes" : "Confirmar Compra"}
                  </Button>

                  {coins < selectedItem.price && (
                    <p className="text-center text-red-300 text-sm mt-3">
                      Voce precisa de mais {(selectedItem.price - coins).toLocaleString()} moedas
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de compra (playmats) */}
      {selectedPlaymat && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !purchaseSuccess && setSelectedPlaymat(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Comprar playmat ${selectedPlaymat.name}`}
        >
          <div
            className="relative w-full max-w-lg bg-[#12141f] rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            {purchaseSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-400/25 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-300" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-white mb-2">Playmat Adquirido!</h3>
                <p className="text-slate-400 leading-relaxed">
                  O playmat foi adicionado direto a sua conta. Equipe-o nas configuracoes ou no editor de decks.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSelectedPlaymat(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-[#0a0b12]/70 hover:bg-[#0a0b12] transition-colors z-20 backdrop-blur-sm"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4 text-slate-300" />
                </button>

                <div className="relative aspect-[3/2]">
                  <Image
                    src={selectedPlaymat.image || "/placeholder.svg"}
                    alt={`Playmat ${selectedPlaymat.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 512px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12141f] via-transparent to-transparent" />
                  <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(10,11,18,0.5)]" />
                  <div className="absolute bottom-0 inset-x-0 p-5">
                    <span className="text-[10px] font-bold tracking-[0.3em] text-amber-400 uppercase">
                      Playmat Exclusivo
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-white mt-1 text-balance">
                      {selectedPlaymat.name}
                    </h3>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{selectedPlaymat.description}</p>

                  <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 mb-5 text-sm text-slate-300">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    Compra unica — apos comprar, o playmat vai direto para sua conta.
                  </div>

                  <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2.5">
                    Escolha como pagar
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={() => handlePlaymatPurchase(selectedPlaymat, "gear")}
                      disabled={gearCoins < selectedPlaymat.gearPrice}
                      className="h-auto py-3.5 flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] hover:border-white/25 text-slate-100 font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Image
                        src="/images/gear-coin.png"
                        alt="Gear Coins"
                        width={22}
                        height={22}
                        className="w-[22px] h-[22px] object-contain"
                      />
                      <span className="tabular-nums">{selectedPlaymat.gearPrice.toLocaleString()}</span>
                      <span className="font-medium text-slate-400 text-xs">Gear</span>
                    </Button>
                    <Button
                      onClick={() => handlePlaymatPurchase(selectedPlaymat, "gacha")}
                      disabled={coins < selectedPlaymat.gachaPrice}
                      className="h-auto py-3.5 flex items-center justify-center gap-2 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 hover:border-amber-400/50 text-amber-200 font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Image
                        src="/images/icons/gacha-coin.png"
                        alt="Gacha Coins"
                        width={22}
                        height={22}
                        className="w-[22px] h-[22px] object-contain"
                      />
                      <span className="tabular-nums">{selectedPlaymat.gachaPrice.toLocaleString()}</span>
                      <span className="font-medium text-amber-300/70 text-xs">Gacha</span>
                    </Button>
                  </div>

                  {gearCoins < selectedPlaymat.gearPrice && coins < selectedPlaymat.gachaPrice && (
                    <p className="text-center text-red-300 text-sm mt-3">
                      Saldo insuficiente nas duas moedas para esta compra.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Visualizacao 3D (clique e segure em um item) */}
      {preview3D && <ItemPreview3D item={preview3D} onClose={() => setPreview3D(null)} />}
    </div>
  )
}
