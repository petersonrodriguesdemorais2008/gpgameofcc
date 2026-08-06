"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Package,
  Star,
  Gift,
  Zap,
  ShoppingCart,
  Clock,
  Check,
  X,
  LayoutGrid,
  Lock,
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
    contents: ["10x Packs FSG", "5x Packs ANL", "1000 Moedas Bonus"]
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
    contents: ["5x Packs Premium", "1x UR/LR Garantido", "500 FP Bonus"]
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
    contents: ["15x Packs Sortidos", "2000 Moedas"]
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
    contents: ["5x Packs FSG (4 cartas cada)"]
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
    contents: ["5x Packs ANL (4 cartas cada)"]
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
    contents: ["50x Packs Sortidos", "5000 Moedas", "1000 FP", "1x Playmat Exclusivo"]
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

export default function ShopScreen({ onBack }: ShopScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, gearCoins, setGearCoins, addGift, ownedPlaymats, unlockPlaymat } = useGame()
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [selectedPlaymat, setSelectedPlaymat] = useState<PlaymatShopItem | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("featured")

  const ownsPlaymat = (playmatId: string) => ownedPlaymats.some((p) => p.id === playmatId)

  const handlePurchase = (item: ShopItem) => {
    if (item.currency === "coins" && coins < item.price) return

    setCoins(coins - item.price)

    // Add rewards to gift box
    addGift({
      title: `Compra: ${item.name}`,
      message: `Voce adquiriu ${item.name}! Aproveite suas recompensas.`,
      coinsReward: item.type === "bundle" ? 500 : undefined
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

    // Delivered straight to the player's account
    unlockPlaymat(item.playmatId)

    setPurchaseSuccess(true)
    setTimeout(() => {
      setPurchaseSuccess(false)
      setSelectedPlaymat(null)
    }, 2000)
  }

  const getRarityStyles = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return {
          border: "border-amber-500/40",
          bg: "from-amber-950/60 to-slate-900/80",
          badge: "bg-amber-400/15 text-amber-300 border border-amber-400/30",
          label: "Lendario",
        }
      case "epic":
        return {
          border: "border-purple-500/40",
          bg: "from-purple-950/60 to-slate-900/80",
          badge: "bg-purple-400/15 text-purple-300 border border-purple-400/30",
          label: "Epico",
        }
      case "rare":
        return {
          border: "border-sky-500/40",
          bg: "from-sky-950/60 to-slate-900/80",
          badge: "bg-sky-400/15 text-sky-300 border border-sky-400/30",
          label: "Raro",
        }
      default:
        return {
          border: "border-slate-600/50",
          bg: "from-slate-800/60 to-slate-900/80",
          badge: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
          label: "Comum",
        }
    }
  }

  const filteredItems = SHOP_ITEMS.filter(item => {
    if (activeTab === "featured") return item.limited || item.discount
    if (activeTab === "packs") return item.type === "pack"
    if (activeTab === "bundles") return item.type === "bundle" || item.type === "special"
    return false
  })

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(251,191,36,0.5) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-64"
          style={{
            backgroundImage: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(251,191,36,0.07) 0%, transparent 70%)"
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 bg-slate-950/70 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-slate-300 hover:text-white hover:bg-slate-800/60 shrink-0"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t("back")}
          </Button>

          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold tracking-widest text-amber-300">LOJA</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-800/80 pl-1.5 pr-3 py-1 rounded-full border border-slate-700">
              <Image src="/images/gear-coin.png" alt="Gear Coins" width={24} height={24} className="w-6 h-6 object-contain" />
              <span className="font-bold text-yellow-200 text-sm tabular-nums">{gearCoins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/80 pl-1.5 pr-3 py-1 rounded-full border border-slate-700">
              <Image src="/images/icons/gacha-coin.png" alt="Gacha Coins" width={24} height={24} className="w-6 h-6 object-contain" />
              <span className="font-bold text-amber-300 text-sm tabular-nums">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative z-10 max-w-6xl w-full mx-auto">
        {/* Featured Banner */}
        {activeTab === "featured" && (
          <div className="mb-6 relative overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-950/70 to-slate-900/70 px-6 py-5">
            <div className="relative z-10">
              <span className="text-amber-400/90 font-bold text-xs tracking-[0.2em]">OFERTAS ESPECIAIS</span>
              <h2 className="text-2xl font-bold text-white mt-1 text-balance">Promocao de Lancamento</h2>
              <p className="text-slate-400 text-sm mt-1">Ate 50% de desconto em packs selecionados</p>
            </div>
          </div>
        )}

        {/* Playmats Tab */}
        {activeTab === "playmats" ? (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white">Playmats de Duelo</h2>
              <p className="text-slate-400 text-sm mt-1">
                Compra unica por playmat. Pague com Gear Coins ou Gacha Coins — o item vai direto para sua conta.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLAYMAT_SHOP_ITEMS.map((item) => {
                const owned = ownsPlaymat(item.playmatId)
                return (
                  <div
                    key={item.playmatId}
                    onClick={() => !owned && setSelectedPlaymat(item)}
                    className={`group relative rounded-xl overflow-hidden border bg-slate-900/70 transition-all duration-200 ${
                      owned
                        ? "border-emerald-600/40"
                        : "border-slate-700 hover:border-amber-400/50 cursor-pointer hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Playmat art (landscape) */}
                    <div className="relative aspect-[3/2] overflow-hidden">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={`Playmat ${item.name}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className={`object-cover transition-transform duration-500 ${owned ? "" : "group-hover:scale-[1.03]"}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                      {owned && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" />
                          Adquirido
                        </div>
                      )}

                      <div className="absolute bottom-0 inset-x-0 p-4">
                        <h3 className="text-white font-bold text-lg leading-tight text-balance">{item.name}</h3>
                        <p className="text-slate-300/80 text-sm mt-1 line-clamp-2">{item.description}</p>
                      </div>
                    </div>

                    {/* Price row */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
                      {owned ? (
                        <span className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Ja esta na sua conta
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <Image src="/images/gear-coin.png" alt="Gear Coins" width={20} height={20} className="w-5 h-5 object-contain" />
                              <span className="text-yellow-200 font-bold tabular-nums">{item.gearPrice.toLocaleString()}</span>
                            </span>
                            <span className="text-slate-600 text-xs font-semibold">OU</span>
                            <span className="flex items-center gap-1.5">
                              <Image src="/images/icons/gacha-coin.png" alt="Gacha Coins" width={20} height={20} className="w-5 h-5 object-contain" />
                              <span className="text-amber-300 font-bold tabular-nums">{item.gachaPrice.toLocaleString()}</span>
                            </span>
                          </div>
                          <span className="text-amber-400/90 text-sm font-semibold group-hover:text-amber-300">
                            Ver oferta
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Items Grid (packs / bundles / featured) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const styles = getRarityStyles(item.rarity)
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${styles.border} border bg-gradient-to-b ${styles.bg}`}
                >
                  {/* Badges */}
                  <div className="absolute top-3 inset-x-3 z-20 flex items-start justify-between">
                    {item.limited ? (
                      <span className="flex items-center gap-1.5 bg-red-500/90 text-white text-xs font-bold px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        {item.timeLeft}
                      </span>
                    ) : <span />}
                    {item.discount && (
                      <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        -{item.discount}%
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="relative z-10 p-4">
                    <div className="relative w-full h-36 mb-4 flex items-center justify-center">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        width={120}
                        height={168}
                        className="w-auto h-32 object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${styles.badge}`}>
                        {item.type === "bundle" && <Gift className="w-3 h-3" />}
                        {item.type === "special" && <Zap className="w-3 h-3" />}
                        {item.type === "pack" && <Package className="w-3 h-3" />}
                        {styles.label}
                      </span>
                    </div>

                    <h3 className="text-white font-bold text-base mb-1">{item.name}</h3>
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">{item.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.originalPrice && (
                          <span className="text-slate-500 text-sm line-through tabular-nums">{item.originalPrice}</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Image src="/images/icons/gacha-coin.png" alt="Gacha Coins" width={20} height={20} className="w-5 h-5" />
                          <span className="text-amber-300 font-bold text-lg tabular-nums">{item.price}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={coins < item.price}
                        className="bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-40"
                      >
                        Comprar
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Purchase Modal (packs/bundles) */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !purchaseSuccess && setSelectedItem(null)}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {purchaseSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Compra Realizada!</h3>
                <p className="text-slate-400">Verifique sua caixa de presentes para coletar as recompensas.</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/70 hover:bg-slate-700 transition-colors z-20"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>

                <div className="p-6 pb-0">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-4 bg-slate-800/60 flex items-center justify-center">
                    <Image
                      src={selectedItem.image || "/placeholder.svg"}
                      alt={selectedItem.name}
                      width={180}
                      height={252}
                      className="w-auto h-40 object-contain drop-shadow-xl"
                    />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">{selectedItem.name}</h3>
                  <p className="text-slate-400 mb-4">{selectedItem.description}</p>

                  {selectedItem.contents && (
                    <div className="bg-slate-800/60 rounded-xl p-4 mb-4">
                      <p className="text-amber-300 font-semibold text-sm mb-2">Conteudo:</p>
                      <ul className="space-y-1">
                        {selectedItem.contents.map((content, i) => (
                          <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                            <Star className="w-3 h-3 text-amber-400" />
                            {content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-950/60 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400">Preco total:</span>
                    <div className="flex items-center gap-2">
                      {selectedItem.originalPrice && (
                        <span className="text-slate-500 text-lg line-through tabular-nums">{selectedItem.originalPrice}</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Image src="/images/icons/gacha-coin.png" alt="Gacha Coins" width={28} height={28} className="w-7 h-7" />
                        <span className="text-amber-300 font-bold text-2xl tabular-nums">{selectedItem.price}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handlePurchase(selectedItem)}
                    disabled={coins < selectedItem.price}
                    className="w-full py-6 text-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {coins < selectedItem.price ? (
                      "Moedas Insuficientes"
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Confirmar Compra
                      </span>
                    )}
                  </Button>

                  {coins < selectedItem.price && (
                    <p className="text-center text-red-400 text-sm mt-2">
                      Voce precisa de mais {selectedItem.price - coins} moedas
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Purchase Modal (playmats) */}
      {selectedPlaymat && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !purchaseSuccess && setSelectedPlaymat(null)}
        >
          <div
            className="relative w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {purchaseSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Playmat Adquirido!</h3>
                <p className="text-slate-400">
                  O playmat foi adicionado direto a sua conta. Equipe-o nas configuracoes ou no editor de decks.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSelectedPlaymat(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/70 hover:bg-slate-700 transition-colors z-20"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5 text-slate-300" />
                </button>

                {/* Playmat preview */}
                <div className="relative aspect-[3/2]">
                  <Image
                    src={selectedPlaymat.image || "/placeholder.svg"}
                    alt={`Playmat ${selectedPlaymat.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 512px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5">
                    <span className="text-amber-400/90 font-bold text-xs tracking-[0.2em]">PLAYMAT EXCLUSIVO</span>
                    <h3 className="text-2xl font-bold text-white mt-1 text-balance">{selectedPlaymat.name}</h3>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-slate-400 text-sm mb-4">{selectedPlaymat.description}</p>

                  <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2.5 mb-5 text-sm text-slate-300">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    Compra unica — apos comprar, o playmat vai direto para sua conta.
                  </div>

                  <p className="text-slate-400 text-sm font-semibold mb-2">Escolha como pagar:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={() => handlePlaymatPurchase(selectedPlaymat, "gear")}
                      disabled={gearCoins < selectedPlaymat.gearPrice}
                      className="h-auto py-3 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-yellow-400/40 text-yellow-100 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Image src="/images/gear-coin.png" alt="Gear Coins" width={24} height={24} className="w-6 h-6 object-contain" />
                      <span className="tabular-nums">{selectedPlaymat.gearPrice.toLocaleString()}</span>
                      <span className="font-medium text-yellow-200/70 text-sm">Gear</span>
                    </Button>
                    <Button
                      onClick={() => handlePlaymatPurchase(selectedPlaymat, "gacha")}
                      disabled={coins < selectedPlaymat.gachaPrice}
                      className="h-auto py-3 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-amber-100 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Image src="/images/icons/gacha-coin.png" alt="Gacha Coins" width={24} height={24} className="w-6 h-6 object-contain" />
                      <span className="tabular-nums">{selectedPlaymat.gachaPrice.toLocaleString()}</span>
                      <span className="font-medium text-amber-200/70 text-sm">Gacha</span>
                    </Button>
                  </div>

                  {gearCoins < selectedPlaymat.gearPrice && coins < selectedPlaymat.gachaPrice && (
                    <p className="text-center text-red-400 text-sm mt-3">
                      Saldo insuficiente nas duas moedas para esta compra.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
