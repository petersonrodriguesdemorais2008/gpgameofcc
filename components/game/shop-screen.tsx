"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Sparkles, 
  Package, 
  Crown, 
  Star, 
  Gift, 
  Zap,
  ShoppingCart,
  Clock,
  Check,
  X
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

export default function ShopScreen({ onBack }: ShopScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, addGift, friendPoints } = useGame()
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<"featured" | "packs" | "bundles">("featured")

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

  const getRarityStyles = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return {
          border: "border-amber-500/60",
          glow: "shadow-amber-500/30",
          bg: "from-amber-900/40 to-orange-900/40",
          badge: "bg-gradient-to-r from-amber-500 to-yellow-400 text-black"
        }
      case "epic":
        return {
          border: "border-purple-500/60",
          glow: "shadow-purple-500/30",
          bg: "from-purple-900/40 to-pink-900/40",
          badge: "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
        }
      case "rare":
        return {
          border: "border-blue-500/60",
          glow: "shadow-blue-500/30",
          bg: "from-blue-900/40 to-cyan-900/40",
          badge: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
        }
      default:
        return {
          border: "border-slate-500/60",
          glow: "shadow-slate-500/20",
          bg: "from-slate-800/40 to-slate-700/40",
          badge: "bg-slate-600 text-white"
        }
    }
  }

  const filteredItems = SHOP_ITEMS.filter(item => {
    if (activeTab === "featured") return item.limited || item.discount
    if (activeTab === "packs") return item.type === "pack"
    if (activeTab === "bundles") return item.type === "bundle" || item.type === "special"
    return true
  })

  return (
  <div className="min-h-screen flex flex-col relative overflow-hidden">
  {/* Premium Background */}
  <div className="fixed inset-0">
  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950" />
  <div className="absolute inset-0 bg-gradient-to-t from-amber-900/15 via-transparent to-purple-900/10" />
  <div
  className="absolute inset-0 opacity-[0.04]"
  style={{
  backgroundImage: `radial-gradient(circle at 2px 2px, rgba(251,191,36,0.4) 1px, transparent 0)`,
  backgroundSize: "48px 48px",
  }}
  />
  <div 
  className="absolute inset-0"
  style={{
  backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(251,191,36,0.08) 0%, transparent 50%)"
  }}
  />
  </div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-amber-400/20 rounded-full animate-float"
            style={{
              left: `${(i * 7) % 100}%`,
              top: `${(i * 11) % 100}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${4 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 glass-dark border-b border-amber-500/20">
        <div className="flex items-center justify-between p-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t("back")}
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              LOJA
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-slate-800/90 to-slate-700/90 px-4 py-2 rounded-full border border-amber-400/30 shadow-lg">
              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={32} height={32} className="w-8 h-8 object-contain" />
              <span className="font-bold text-white text-lg">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-4">
          {[
            { id: "featured", label: "Destaque", icon: Star },
            { id: "packs", label: "Packs", icon: Package },
            { id: "bundles", label: "Bundles", icon: Gift },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                activeTab === id
                  ? "bg-gradient-to-r from-amber-600 to-yellow-500 text-black shadow-lg shadow-amber-500/30"
                  : "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto relative z-10">
        {/* Featured Banner */}
        {activeTab === "featured" && (
          <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900/50 via-yellow-900/40 to-amber-900/50 border border-amber-500/30 p-6">
            <div className="absolute inset-0 bg-[url('/images/gacha/pack-anl.png')] opacity-10 bg-cover bg-center" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-6 h-6 text-amber-400" />
                  <span className="text-amber-400 font-bold text-sm tracking-wider">OFERTAS ESPECIAIS</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Promocao de Lancamento!</h2>
                <p className="text-amber-200/70">Ate 50% de desconto em packs selecionados</p>
              </div>
              <Sparkles className="w-16 h-16 text-amber-400/50" />
            </div>
          </div>
        )}

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {filteredItems.map((item) => {
  const styles = getRarityStyles(item.rarity)
  return (
  <div
  key={item.id}
  onClick={() => setSelectedItem(item)}
  className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 ${styles.border} border-2 shadow-xl ${styles.glow} shine-effect`}
  >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${styles.bg}`} />
                
                {/* Limited badge */}
                {item.limited && (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-red-500/90 text-white text-xs font-bold px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    {item.timeLeft}
                  </div>
                )}

                {/* Discount badge */}
                {item.discount && (
                  <div className="absolute top-3 right-3 z-20 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    -{item.discount}%
                  </div>
                )}

                {/* Content */}
                <div className="relative z-10 p-4">
                  {/* Image */}
                  <div className="relative w-full aspect-square mb-4 flex items-center justify-center">
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${styles.bg} opacity-50`} />
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={120}
                      height={168}
                      className="relative z-10 w-auto h-32 object-contain drop-shadow-2xl hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  {/* Info */}
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mb-2 ${styles.badge}`}>
                    {item.type === "bundle" && <Gift className="w-3 h-3" />}
                    {item.type === "special" && <Zap className="w-3 h-3" />}
                    {item.type === "pack" && <Package className="w-3 h-3" />}
                    {item.type.toUpperCase()}
                  </div>

                  <h3 className="text-white font-bold text-lg mb-1">{item.name}</h3>
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">{item.description}</p>

                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.originalPrice && (
                        <span className="text-slate-500 text-sm line-through">{item.originalPrice}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Image src="/images/icons/gacha-coin.png" alt="Coin" width={24} height={24} className="w-6 h-6" />
                        <span className="text-amber-400 font-bold text-xl">{item.price}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={coins < item.price}
                      className={`${styles.badge} hover:opacity-90 disabled:opacity-50`}
                    >
                      Comprar
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Purchase Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !purchaseSuccess && setSelectedItem(null)}
        >
          <div 
            className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-amber-500/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {purchaseSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Compra Realizada!</h3>
                <p className="text-slate-400">Verifique sua caixa de presentes para coletar as recompensas.</p>
              </div>
            ) : (
              <>
                {/* Close button */}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors z-20"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>

                {/* Item preview */}
                <div className="p-6 pb-0">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-amber-900/30 to-slate-900/50 flex items-center justify-center">
                    <Image
                      src={selectedItem.image}
                      alt={selectedItem.name}
                      width={180}
                      height={252}
                      className="w-auto h-40 object-contain drop-shadow-2xl"
                    />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">{selectedItem.name}</h3>
                  <p className="text-slate-400 mb-4">{selectedItem.description}</p>

                  {/* Contents */}
                  {selectedItem.contents && (
                    <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                      <p className="text-amber-400 font-semibold text-sm mb-2">Conteudo:</p>
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

                {/* Purchase section */}
                <div className="p-6 bg-slate-800/50 border-t border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400">Preco total:</span>
                    <div className="flex items-center gap-2">
                      {selectedItem.originalPrice && (
                        <span className="text-slate-500 text-lg line-through">{selectedItem.originalPrice}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Image src="/images/icons/gacha-coin.png" alt="Coin" width={32} height={32} className="w-8 h-8" />
                        <span className="text-amber-400 font-bold text-2xl">{selectedItem.price}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handlePurchase(selectedItem)}
                    disabled={coins < selectedItem.price}
                    className="w-full py-6 text-lg font-bold bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}
