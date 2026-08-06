"use client"

import Image from "next/image"
import { Clock } from "lucide-react"

/*
 * ShopOfferCard — "O Cofre do Mercador"
 * Card de oferta padrão AAA para o Mercado.
 *
 * Princípios aplicados:
 * - Raridade como material: cantos (corner brackets) + glow ambiente, via CSS vars
 * - Cluster de preço unificado: preço antigo + desconto + CTA com preço em um só grupo
 * - Integração de asset: eco de cor, piso com reflexo, vinheta, máscara vertical
 * - Estados: default / hover / sem saldo (vira funil "Obter moedas") / esgotado
 */

export type OfferRarity = "common" | "rare" | "epic" | "legendary"

export interface ShopOffer {
  id: string
  name: string
  tagline: string
  price: number
  originalPrice?: number
  discount?: number
  image: string
  rarity: OfferRarity
  timeLeft?: string
  soldOut?: boolean
}

const RARITY_VARS: Record<OfferRarity, { label: string; style: React.CSSProperties }> = {
  legendary: {
    label: "Lendário",
    style: { "--rarity": "#F5C445", "--rarity-glow": "rgba(245,196,69,0.32)" } as React.CSSProperties,
  },
  epic: {
    label: "Épico",
    style: { "--rarity": "#A855F7", "--rarity-glow": "rgba(168,85,247,0.30)" } as React.CSSProperties,
  },
  rare: {
    label: "Raro",
    style: { "--rarity": "#38BDF8", "--rarity-glow": "rgba(56,189,248,0.28)" } as React.CSSProperties,
  },
  common: {
    label: "Comum",
    style: { "--rarity": "#94A3B8", "--rarity-glow": "rgba(148,163,184,0.16)" } as React.CSSProperties,
  },
}

interface ShopOfferCardProps {
  offer: ShopOffer
  balance: number
  onBuy: (offer: ShopOffer) => void
  onGetCoins?: () => void
}

export default function ShopOfferCard({ offer, balance, onBuy, onGetCoins }: ShopOfferCardProps) {
  const rarity = RARITY_VARS[offer.rarity]
  const canAfford = balance >= offer.price
  const disabled = offer.soldOut

  return (
    <article
      style={rarity.style}
      className="vault-card group relative flex flex-col overflow-hidden rounded-xl bg-[#141824] transition-transform duration-300 ease-out hover:-translate-y-1"
      aria-label={`${offer.name} — ${rarity.label}`}
    >
      {/* Moldura de raridade: 4 cantos (corner brackets) */}
      <span aria-hidden="true" className="vault-corner vault-corner--tl" />
      <span aria-hidden="true" className="vault-corner vault-corner--tr" />
      <span aria-hidden="true" className="vault-corner vault-corner--bl" />
      <span aria-hidden="true" className="vault-corner vault-corner--br" />

      {/* ZONA DA ARTE — vitrine com piso, glow e máscara de integração */}
      <div className="vault-stage relative flex h-52 items-end justify-center overflow-visible pb-6">
        {/* Eco de cor da raridade atrás do produto */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: "radial-gradient(ellipse 60% 55% at 50% 62%, var(--rarity-glow) 0%, transparent 70%)",
          }}
        />

        {/* Linha de horizonte — dá "chão" ao produto */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: "linear-gradient(to top, rgba(7,9,15,0.75), transparent)" }}
        />

        {/* Badges: timer (urgência) à esquerda */}
        {offer.timeLeft && !disabled && (
          <span className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-md border border-[#E85D4C]/35 bg-[#0B0D14]/90 px-2 py-1 text-[11px] font-semibold tabular-nums text-[#E85D4C]">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Tempo restante: </span>
            {offer.timeLeft}
          </span>
        )}

        {/* Arte do produto — sobe e escala no hover; reflexo encolhe */}
        <div className="relative z-10 transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.05]">
          <Image
            src={offer.image || "/placeholder.svg"}
            alt=""
            width={130}
            height={182}
            className="h-36 w-auto object-contain drop-shadow-[0_14px_20px_rgba(0,0,0,0.65)]"
          />
          {/* Reflexo especular no piso */}
          <span
            aria-hidden="true"
            className="absolute -bottom-3 left-1/2 h-3 w-[72%] -translate-x-1/2 rounded-[50%] blur-[3px] transition-all duration-500 group-hover:w-[58%] group-hover:opacity-60"
            style={{ background: "var(--rarity-glow)" }}
          />
        </div>

        {disabled && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0D14]/70 backdrop-blur-[2px]">
            <span className="rounded-md border border-[#2A3145] bg-[#141824] px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-[#8B93A7]">
              Esgotado
            </span>
          </div>
        )}
      </div>

      {/* PAINEL DE INFORMAÇÃO — sem costura dura com a arte */}
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-5">
        {/* Overline de raridade — cor plena, legível */}
        <span
          className="text-[11px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "var(--rarity)" }}
        >
          {rarity.label}
        </span>

        <h3 className="mt-1 font-serif text-xl font-bold leading-tight text-[#F2EFE6] text-balance">
          {offer.name}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B93A7] line-clamp-2">{offer.tagline}</p>

        {/* CLUSTER DE PREÇO — desconto, preço antigo e CTA agrupados */}
        <div className="mt-auto pt-4">
          {(offer.originalPrice || offer.discount) && !disabled && (
            <div className="mb-1.5 flex items-center gap-2">
              {offer.originalPrice && (
                <s className="text-xs tabular-nums text-[#8B93A7]/70">
                  {offer.originalPrice.toLocaleString("pt-BR")}
                </s>
              )}
              {offer.discount && (
                <span className="rounded-sm bg-[#E85D4C] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#0B0D14]">
                  -{offer.discount}%
                </span>
              )}
            </div>
          )}

          {disabled ? (
            <div className="flex h-11 w-full items-center justify-center rounded-lg border border-[#2A3145] bg-[#1C2233] text-sm font-semibold text-[#8B93A7]">
              Indisponível
            </div>
          ) : canAfford ? (
            <button
              type="button"
              onClick={() => onBuy(offer)}
              className="vault-cta flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[15px] font-bold text-[#0B0D14] transition-transform duration-150 active:scale-[0.98]"
            >
              <Image
                src="/images/icons/gacha-coin.png"
                alt="Gacha Coins"
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
              />
              <span className="tabular-nums">{offer.price.toLocaleString("pt-BR")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onGetCoins}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#E8B44C]/40 bg-[#E8B44C]/10 text-sm font-bold text-[#E8B44C] transition-colors duration-150 hover:bg-[#E8B44C]/20"
            >
              <span className="tabular-nums text-[#8B93A7]">
                Faltam {(offer.price - balance).toLocaleString("pt-BR")}
              </span>
              <span aria-hidden="true" className="h-4 w-px bg-[#E8B44C]/30" />
              Obter moedas
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
