"use client"

/**
 * INVENTÁRIO — tela com todos os itens que o jogador possui.
 *
 * Mostra moedas (Gear Coins, Gacha Coins), Pontos de Amizade e Fragmentos.
 * NÃO mostra cartas, packs, playmats, sleeves, skins de cartas nem ícones —
 * esses vivem em suas próprias telas (Coleção, Loja, Perfil).
 *
 * Os itens podem ser pesquisados por nome e filtrados por categoria.
 */

import { useMemo, useState } from "react"
import { useGame } from "@/contexts/game-context"
import { FRAGMENTS, type FragmentId } from "@/lib/fragments"
import {
  SKIP_TICKET_COLOR,
  SKIP_TICKET_DESCRIPTION,
  SKIP_TICKET_IMAGE,
  SKIP_TICKET_NAME,
} from "@/lib/skip-ticket"
import { ArrowLeft, Search, X, Backpack, HeartHandshake } from "lucide-react"
import Image from "next/image"

type ItemCategory = "moedas" | "fragmentos" | "pontos" | "itens"

interface InventoryItem {
  id: string
  name: string
  description: string
  category: ItemCategory
  quantity: number
  image?: string
  /** Cor de destaque (borda/brilho do card). */
  color: string
  /** Ícone alternativo quando não há imagem. */
  fallbackIcon?: React.ReactNode
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  moedas: "Moedas",
  itens: "Itens",
  fragmentos: "Fragmentos",
  pontos: "Pontos",
}

const CATEGORY_ORDER: ItemCategory[] = ["moedas", "itens", "fragmentos", "pontos"]

const FILTERS: { id: "todos" | ItemCategory; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "moedas", label: "Moedas" },
  { id: "itens", label: "Itens" },
  { id: "fragmentos", label: "Fragmentos" },
  { id: "pontos", label: "Pontos" },
]

const INV_CSS = `
@keyframes inv-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.inv-card {
  animation: inv-fade-in 0.35s ease both;
  background: linear-gradient(160deg, rgba(10,5,32,0.92), rgba(5,2,18,0.96));
  border: 1px solid rgba(124,58,237,0.22);
  border-radius: 16px;
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.inv-card:hover {
  transform: translateY(-3px);
  border-color: var(--inv-color, rgba(139,92,246,0.55));
  box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 0 18px var(--inv-glow, rgba(139,92,246,0.25));
}
.inv-chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  border: 1px solid rgba(124,58,237,0.28);
  background: rgba(10,5,32,0.85);
  color: rgba(167,139,250,0.75);
  cursor: pointer;
  transition: all .2s ease;
  white-space: nowrap;
}
.inv-chip:hover { border-color: rgba(139,92,246,0.55); color: rgba(196,165,250,1); }
.inv-chip.active {
  background: linear-gradient(135deg, rgba(109,40,217,0.55), rgba(139,92,246,0.35));
  border-color: rgba(167,139,250,0.8);
  color: #fff;
  box-shadow: 0 0 14px rgba(124,58,237,0.35);
}
.inv-search {
  background: rgba(10,5,32,0.85);
  border: 1px solid rgba(124,58,237,0.28);
  border-radius: 12px;
  color: #fff;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.inv-search:focus-within {
  border-color: rgba(139,92,246,0.65);
  box-shadow: 0 0 14px rgba(124,58,237,0.25);
}
`

export default function InventoryScreen({ onBack }: { onBack: () => void }) {
  const { coins, gearCoins, friendPoints, fragments, skipTickets } = useGame()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"todos" | ItemCategory>("todos")

  const items = useMemo<InventoryItem[]>(() => {
    const list: InventoryItem[] = [
      {
        id: "gear-coins",
        name: "Gear Coins",
        description: "Moeda comum usada na Loja.",
        category: "moedas",
        quantity: gearCoins,
        image: "/images/gear-coin.png",
        color: "#e2e8f0",
      },
      {
        id: "gacha-coins",
        name: "Gacha Coins",
        description: "Moeda premium usada no Gacha para puxar pacotes.",
        category: "moedas",
        quantity: coins,
        image: "/images/Gacha_Coin.png",
        color: "#fcd34d",
      },
      {
        id: "skip-ticket",
        name: SKIP_TICKET_NAME,
        description: SKIP_TICKET_DESCRIPTION,
        category: "itens",
        quantity: skipTickets,
        image: SKIP_TICKET_IMAGE,
        color: SKIP_TICKET_COLOR,
      },
      {
        id: "friend-points",
        name: "Pontos de Amizade",
        description: "Ganhos ao interagir com amigos. Troque por recompensas.",
        category: "pontos",
        quantity: friendPoints,
        color: "#f9a8d4",
        fallbackIcon: <HeartHandshake style={{ width: 40, height: 40, color: "#f9a8d4" }} />,
      },
    ]

    // Fragmentos — só os que o jogador realmente possui aparecem com contagem,
    // mas todos são listados (quantidade 0 fica visível para referência).
    for (const id of Object.keys(FRAGMENTS) as FragmentId[]) {
      const def = FRAGMENTS[id]
      list.push({
        id: `fragment-${id}`,
        name: def.name,
        description:
          id === "galio"
            ? "Material comum dropado em todos os Treinamentos Especiais."
            : "Fragmento elemental dropado nos duelos de Eventos.",
        category: "fragmentos",
        quantity: fragments[id] ?? 0,
        image: def.image,
        color: def.color,
      })
    }

    return list
  }, [coins, gearCoins, friendPoints, fragments, skipTickets])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== "todos" && item.category !== filter) return false
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, filter])

  // Agrupa por categoria mantendo a ordem definida
  const grouped = useMemo(() => {
    const map = new Map<ItemCategory, InventoryItem[]>()
    for (const cat of CATEGORY_ORDER) {
      const inCat = visible.filter((i) => i.category === cat)
      if (inCat.length > 0) map.set(cat, inCat)
    }
    return map
  }, [visible])

  const totalOwned = useMemo(
    () => items.reduce((acc, i) => acc + (i.quantity > 0 ? 1 : 0), 0),
    [items],
  )

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "linear-gradient(160deg, #050212 0%, #0a0520 55%, #050212 100%)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: INV_CSS }} />

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{
          background: "linear-gradient(180deg, rgba(5,2,18,0.97), rgba(5,2,18,0.88))",
          borderBottom: "1px solid rgba(124,58,237,0.22)",
          backdropFilter: "blur(16px)",
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar ao menu"
          className="flex items-center justify-center rounded-xl transition-colors"
          style={{
            width: 40,
            height: 40,
            background: "rgba(10,5,32,0.9)",
            border: "1px solid rgba(124,58,237,0.3)",
            color: "rgba(167,139,250,0.9)",
            cursor: "pointer",
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <Backpack className="w-6 h-6" style={{ color: "rgba(167,139,250,0.9)" }} />
          <div className="flex flex-col">
            <h1
              className="font-black uppercase"
              style={{ fontSize: 17, letterSpacing: "2.5px", color: "#fff", lineHeight: 1.1 }}
            >
              Inventário
            </h1>
            <span style={{ fontSize: 10.5, color: "rgba(167,139,250,0.55)", fontWeight: 700 }}>
              {totalOwned} {totalOwned === 1 ? "item possuído" : "itens possuídos"}
            </span>
          </div>
        </div>
      </header>

      {/* ── BUSCA + FILTROS ── */}
      <div className="mx-auto w-full max-w-5xl px-4 pt-5 flex flex-col gap-3">
        <div className="inv-search flex items-center gap-2 px-3.5 py-2.5">
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(167,139,250,0.6)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar item por nome..."
            aria-label="Pesquisar item por nome"
            className="w-full bg-transparent outline-none"
            style={{ fontSize: 14, color: "#fff" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar pesquisa"
              className="flex-shrink-0"
              style={{ color: "rgba(167,139,250,0.7)", cursor: "pointer", background: "none", border: "none", padding: 2 }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por categoria">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`inv-chip${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTA DE ITENS ── */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 flex flex-col gap-7">
        {grouped.size === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16"
            style={{ border: "1px dashed rgba(124,58,237,0.3)", background: "rgba(10,5,32,0.5)" }}
          >
            <Search className="w-8 h-8" style={{ color: "rgba(139,92,246,0.5)" }} />
            <p style={{ color: "rgba(167,139,250,0.75)", fontSize: 14, fontWeight: 700 }}>
              Nenhum item encontrado
            </p>
            <p style={{ color: "rgba(139,92,246,0.5)", fontSize: 12 }}>
              Tente outro nome ou mude o filtro de categoria.
            </p>
          </div>
        )}

        {[...grouped.entries()].map(([cat, catItems]) => (
          <section key={cat} aria-label={CATEGORY_LABELS[cat]}>
            <div className="flex items-center gap-3 mb-3">
              <h2
                className="font-black uppercase"
                style={{ fontSize: 12, letterSpacing: "2.5px", color: "rgba(196,165,250,0.9)" }}
              >
                {CATEGORY_LABELS[cat]}
              </h2>
              <div
                className="flex-1"
                style={{ height: 1, background: "linear-gradient(90deg, rgba(139,92,246,0.35), transparent)" }}
              />
              <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(139,92,246,0.55)" }}>
                {catItems.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  className="inv-card flex flex-col items-center gap-2.5 px-3 py-4 text-center"
                  style={
                    {
                      "--inv-color": item.color,
                      "--inv-glow": `${item.color}40`,
                      opacity: item.quantity > 0 ? 1 : 0.45,
                    } as React.CSSProperties
                  }
                >
                  {/* Imagem / ícone */}
                  <div
                    className="relative flex items-center justify-center rounded-xl"
                    style={{
                      width: 64,
                      height: 64,
                      background: `radial-gradient(circle at 50% 45%, ${item.color}22 0%, transparent 70%)`,
                    }}
                  >
                    {item.image ? (
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        width={56}
                        height={56}
                        className="object-contain"
                        style={{ filter: `drop-shadow(0 0 8px ${item.color}55)` }}
                      />
                    ) : (
                      item.fallbackIcon
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 min-w-0 w-full">
                    <span
                      className="font-bold truncate"
                      style={{ fontSize: 13, color: "#fff", letterSpacing: "0.3px" }}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontSize: 10.5, color: "rgba(167,139,250,0.55)", lineHeight: 1.45 }}>
                      {item.description}
                    </span>
                  </div>

                  {/* Quantidade */}
                  <div
                    className="mt-auto rounded-lg px-3 py-1 font-black tabular-nums"
                    style={{
                      fontSize: 14,
                      color: item.quantity > 0 ? item.color : "rgba(148,163,184,0.5)",
                      background: "rgba(5,2,18,0.75)",
                      border: `1px solid ${item.quantity > 0 ? `${item.color}55` : "rgba(100,116,139,0.25)"}`,
                      textShadow: item.quantity > 0 ? `0 0 10px ${item.color}66` : "none",
                    }}
                  >
                    ×{item.quantity.toLocaleString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
