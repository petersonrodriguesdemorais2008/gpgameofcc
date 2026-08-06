"use client"

import ShopOfferCard, { type ShopOffer } from "@/components/game/shop-offer-card"

const DEMO_OFFERS: ShopOffer[] = [
  {
    id: "legendary-chest",
    name: "Baú Lendário",
    tagline: "Garantia de pelo menos 1 carta UR ou LR entre 5 packs premium.",
    price: 2500,
    image: "/images/gacha/pack-anl.png",
    rarity: "legendary",
    timeLeft: "23:45:30",
  },
  {
    id: "starter-bundle",
    name: "Pacote Iniciante",
    tagline: "Cartas essenciais para novos duelistas. 10x FSG + 5x ANL + bônus.",
    price: 500,
    originalPrice: 1000,
    discount: 50,
    image: "/images/gacha/pack-fsg.png",
    rarity: "rare",
  },
  {
    id: "mega-bundle",
    name: "Mega Bundle",
    tagline: "O melhor custo-benefício: 50 packs sortidos e playmat exclusivo.",
    price: 5000,
    originalPrice: 8000,
    discount: 37,
    image: "/images/gacha/pack-anl.png",
    rarity: "epic",
  },
  {
    id: "pack-fsg",
    name: "5x Pack FSG",
    tagline: "Cinco packs do banner Fundadores da Santa Guerra.",
    price: 50,
    image: "/images/gacha/pack-fsg.png",
    rarity: "common",
  },
]

export default function ShopCardDemoPage() {
  return (
    <main className="min-h-screen bg-[#0B0D14] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#E8B44C]">
          Demo — Novo Design
        </span>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[#F2EFE6]">Card de Oferta do Mercado</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#8B93A7]">
          Quatro raridades e o estado &quot;sem saldo&quot; (último card, que vira funil de conversão). Passe o
          mouse para ver a integração de asset: a arte sobe, o reflexo encolhe e o glow de raridade intensifica.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_OFFERS.map((offer) => (
            <ShopOfferCard
              key={offer.id}
              offer={offer}
              balance={3000}
              onBuy={() => {}}
              onGetCoins={() => {}}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
