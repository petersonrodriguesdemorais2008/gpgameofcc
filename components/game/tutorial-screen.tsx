"use client"

/**
 * tutorial-screen.tsx — Gear Perks Card Game
 *
 * Dois componentes exportados:
 *  • TutorialScreen (default) — fases standalone: Lore + Seleção de Mestre
 *  • TutorialGameOverlay (named) — overlay sobre as telas REAIS: Menu, Duelo, Gacha
 *
 * Fluxo: TitleScreen → TutorialScreen → (game-wrapper navega p/ MainMenu) → TutorialGameOverlay
 */

import { useState, useEffect, useRef, useCallback } from "react"
import type { Card as GameCard } from "@/contexts/game-context"

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TutorialMasterId = "fehnon" | "morgana" | "calem"
type OverlayPhase = "menu" | "duel-sim" | "post-duel-menu" | "gacha"

export interface TutorialScreenProps {
  playerName: string
  /** Chamado quando Mestre foi escolhido — game-wrapper então inicia o overlay */
  onComplete: (selectedMasterId: TutorialMasterId) => void
}

export interface TutorialGameOverlayProps {
  masterId: TutorialMasterId
  /** game-wrapper navega para a tela certa — o duelo do tutorial é 100%
   *  roteirizado/fake (não usa navegação real), só "menu" e "gacha" precisam */
  onNavigate: (screen: "menu" | "gacha") => void
  /** Chamado quando TODO o tutorial (overlay) é concluído */
  onComplete: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER CONFIG  (art path = /images/masters/ conforme main-menu.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

const MASTERS: Record<TutorialMasterId, {
  name: string; color: string; bgGlow: string; shadowGlow: string
  art: string; deckName: string; element: string; deckDesc: string
}> = {
  fehnon: {
    name: "Fehnon Hoskie", color: "#38bdf8",
    bgGlow: "rgba(56,189,248,0.13)", shadowGlow: "rgba(56,189,248,0.55)",
    art: "/images/masters/fehnon-art.png",
    deckName: "Deck Aquos", element: "AQUOS",
    deckDesc: "Ataques poderosos e Combos intensos, domine o campo com Fehnon e seu poder de Ultimate Gear, a Protonix Sword!",
  },
  morgana: {
    name: "Morgana Pendragon", color: "#a855f7",
    bgGlow: "rgba(168,85,247,0.13)", shadowGlow: "rgba(168,85,247,0.55)",
    art: "/images/masters/morgana-art.png",
    deckName: "Deck Darkness", element: "DARKNESS",
    deckDesc: "Sombras Agressivas! Alto poder em efeitos devastadores com a Ultimate Gear Twilight Avalon!",
  },
  calem: {
    name: "Calem Hidenori", color: "#94a3b8",
    bgGlow: "rgba(148,163,184,0.12)", shadowGlow: "rgba(148,163,184,0.45)",
    art: "/images/masters/calem-art.png",
    deckName: "Deck Neutro", element: "VOID",
    deckDesc: "Versátil e equilibrado — perfeito para aprender todas as estratégias do jogo.",
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECK INICIAL — preview das cartas que cada Mestre entrega ao ser escolhido
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// DECK INICIAL — cartas REAIS do jogo (extraídas de ALL_CARDS em game-context.tsx)
// Estes objetos são usados tanto para o preview (StarterDeckModal) quanto para a
// concessão de verdade na conta do jogador (ver buildStarterDeckGrant abaixo,
// chamada pelo game-wrapper.tsx via useGame().addToCollection / saveDeck).
// ═══════════════════════════════════════════════════════════════════════════════

interface DeckEntry { card: GameCard; qty: number }
interface StarterDeck { main: DeckEntry[]; tap: DeckEntry[] }

// ── Cartas neutras compartilhadas pelos 3 decks iniciais (mesmos objetos reais) ─
const CHAMADO_DA_TAVOLA: GameCard = {
  id: "chamado-da-tavola", name: "Chamado da Távola", image: "/images/cards/Chamado_da_Távola.png",
  rarity: "SR", type: "action", element: "Haos", dp: 0,
  ability: "Chamado da Távola",
  abilityDescription: "Procure em seu deck por uma Unidade de Tropa, revele-a e adicione-a à sua mão. Em seguida, embaralhe o seu deck.",
  attack: "", category: "Action Funcion Card",
}
const RUINAS_ABANDONADAS: GameCard = {
  id: "ruinas-abandonadas", name: "Ruínas Abandonadas", image: "/images/ruinas-abandonadas.png",
  rarity: "UR", type: "scenario", element: "Haos", dp: 0,
  ability: "RUÍNAS ABANDONADAS",
  abilityDescription: "Efeito para determinadas cartas de unidades destacadas: Unidades da Irmandade THE GREAT ORDER e Unidades Tropas. Unidades da THE GREAT ORDER recebem +2DP. Unidades Tropas recebem +2DP. Compre uma carta quando esse Scenario for jogado no seu campo. Se uma carta for da Irmandade, mas também for tropa, ele receberá apenas o Efeito da Irmandade.",
  attack: "", category: "Scenario Card",
}
const DADOS_DO_DESTINO: GameCard = {
  id: "dados-do-destino-gentil", name: "Dados do Destino Gentil", image: "/images/cards/dados-do-destino-gentil.png",
  rarity: "SR", type: "item", element: "Haos", dp: 0,
  ability: "Destino Incerto",
  abilityDescription: "Jogue um dado: se cair em 1, 2, ou 3, uma carta de unidade que você tem em campo perde -3DP. Se cair em 4, 5, ou 6, uma carta de unidade que você tem em campo ganha +5DP.",
  attack: "", category: "Item Funcion Card",
}
const AMPLIFICADOR_DE_PODER: GameCard = {
  id: "amplificador-de-poder", name: "Amplificador de Poder", image: "/images/amplificador-de-poder.png",
  rarity: "SR", type: "item", element: "Pyrus", dp: 0,
  ability: "Absorção de Poder",
  abilityDescription: "Selecione uma carta de unidade no campo do oponente, o DP Original dela é somada ao DP total de alguma carta ativa no campo do jogador.",
  attack: "", category: "Item Funcion Card",
}
const BANDAGEM_RESTAURADORA: GameCard = {
  id: "bandagem-restauradora", name: "Bandagem Restauradora", image: "/images/bandagem-restauradora.png",
  rarity: "R", type: "item", element: "Haos", dp: 0,
  ability: "Cura", abilityDescription: "Essa carta cura 2LP do jogador de dano já sofrido.",
  attack: "", category: "Item Funcion Card",
}
const BRINCADEIRA_DE_MAU_GOSTO: GameCard = {
  id: "brincadeira-de-mau-gosto", name: "Brincadeira de Mau Gosto", image: "/images/cards/brincadeira-de-mau-gosto.png",
  rarity: "SR", type: "trap", element: "Darkus", dp: 0,
  ability: "Sabotagem",
  abilityDescription: "Ative quando o oponente usar uma carta de Item Funcion ou uma Action Funcion: Negue o efeito da carta que o oponente ativou, e selecione uma Unidade do oponente e ela perde -2DP, caso ele não tenha Unidades, o oponente é obrigado a revelar a mão dele para você.",
  attack: "", category: "Trap Funcion Card",
}
const A_GRANDE_ORDEM: GameCard = {
  id: "a-grande-ordem", name: "A Grande Ordem", image: "/images/cards/a-grande-ordem.jpg",
  rarity: "UR", type: "action", element: "Void", dp: 0,
  ability: "A Grande Ordem",
  abilityDescription: "Brotherhood Function (Permanece em campo).\n- Unidades Fehnon, Morgana ou Calem recebem +3DP.\n- União: Ao baixar um destes membros, busque outro no deck e adicione à mão.\n- Melodia: (Desativado no ambiente online.)",
  attack: "", category: "Brotherhood Function Card",
}
const LACOS_DA_ORDEM: GameCard = {
  id: "lacos-da-ordem", name: "Laços da Ordem", image: "/images/cards/lacos-da-ordem.png",
  rarity: "SR", type: "action", element: "Void", dp: 0,
  ability: "Laços da Ordem",
  abilityDescription: "Ative esta carta apenas se você possuir 2 ou mais Unidades da Irmandade \"The Great Order\" (Fehnon, Morgana ou Calem) em campo: Recupere uma carta Action Function do seu Cemitério. Se possuir o trio completo em campo, compre uma carta do deck; se for uma Função, escolha uma Unidade sua e adicione +2DP a ela.",
  attack: "", category: "Action Funcion Card",
}

const STARTER_DECKS: Record<TutorialMasterId, StarterDeck> = {
  // ── Fehnon Hoskie — Aquos ────────────────────────────────────────────────────
  fehnon: {
    main: [
      { qty: 4, card: {
        id: "fehnon-sr", name: "Fehnon Hoskie", image: "/images/fehnon-20sr.png",
        rarity: "SR", type: "unit", element: "Aquos", dp: 2,
        ability: "Fluxo de Ruptura",
        abilityDescription: "Quando ele derrota em batalha uma unidade do oponente, cause 2DP como dano extra na vida do oponente por unidade derrotada, essa habilidade pode ser ativada toda vez que ele derrotar uma unidade do oponente.",
        attack: "Laceração",
        attackDescription: "Quando ele ataca, tanto uma unidade do oponente, quanto diretamente, compre uma carta, se for uma carta de unidade, ele pode atacar novamente.",
        category: "Aquos Ultimate Gear user",
      }},
      { qty: 1, card: {
        id: "fehnon-ur", name: "Fehnon Hoskie", image: "/images/fehnon-20ur.png",
        rarity: "UR", type: "unit", element: "Aquos", dp: 3,
        ability: "Singularidade Zero",
        abilityDescription: "Ruptura: Enquanto este card estiver equipado com UG: Protonix Sword, ele pode realizar até dois ataques durante cada Fase de Batalha. Sempre que este personagem destruir uma unidade do oponente em batalha, ele recebe +2 DP até o final do turno.",
        attack: "Ordem de Laceração",
        attackDescription: "Ao declarar um ataque: compre 1 card. Se for uma Unidade, este personagem pode atacar novamente e o oponente não pode ativar efeitos em resposta a este ataque.",
        category: "Aquos Ultimate Gear user",
      }},
      { qty: 2, card: CHAMADO_DA_TAVOLA },
      { qty: 1, card: {
        id: "mr-p-r", name: "O Lorde Penguim Mr. P", image: "/images/mr.png",
        rarity: "R", type: "troops", element: "Aquos", dp: 1,
        ability: "Manuscrito de Guerra",
        abilityDescription: "(Se quiser) Selecione uma unidade do campo do seu oponente e diminua 2DP dela. Selecione uma carta da mão do seu oponente e faça-o descarta-la.",
        attack: "A Pena é Mais Forte que a Espada", category: "Aquos Troops unit",
      }},
      { qty: 1, card: {
        id: "vivian-r", name: "Vivian: A Dama do Lago", image: "/images/vivian-20r.png",
        rarity: "R", type: "troops", element: "Aquos", dp: 1,
        ability: "Abraço das Profundezas",
        abilityDescription: "Quando ela for evocada, você pode escolher uma unidade de 2 ou 3DP do seu deck, e evoca-la no seu campo.",
        attack: "Vapor de Avalon", category: "Aquos Troops unit",
      }},
      { qty: 1, card: RUINAS_ABANDONADAS },
      { qty: 2, card: DADOS_DO_DESTINO },
      { qty: 2, card: AMPLIFICADOR_DE_PODER },
      { qty: 2, card: BANDAGEM_RESTAURADORA },
      { qty: 2, card: BRINCADEIRA_DE_MAU_GOSTO },
      { qty: 1, card: A_GRANDE_ORDEM },
      { qty: 1, card: LACOS_DA_ORDEM },
    ],
    tap: [
      { qty: 1, card: {
        id: "protonix-sword", name: "Ultimate Gear: Protonix Sword", image: "/images/protonix-20sword.png",
        rarity: "SR", type: "ultimateGear", element: "Aquos", dp: 0,
        ability: "PROTONIX SWORD",
        abilityDescription: "Enquanto esta carta estiver equipada, o Fehnon Hoskie recebe +2 DP adicional.",
        attack: "", category: "Aquos Ultimate Gear", requiresUnit: "Fehnon Hoskie",
      }},
      { qty: 1, card: {
        id: "ordem-de-laceracao", name: "Ordem de Laceração", image: "/images/cards/ordem-de-laceracao.png",
        rarity: "UR", type: "magic", element: "Aquos", dp: 0,
        ability: "Ataque Especial de Fehnon",
        abilityDescription: "Se estiver com Fehnon Hoskie em seu campo de batalha, use essa carta e cause 3DP diretamente no seu oponente, essa carta não pode ser negada por efeito de habilidades de cartas unidade do seu oponente.",
        attack: "", category: "Magic Funcion Card", requiresUnit: "fehnon",
      }},
    ],
  },

  // ── Morgana Pendragon — Darkus ───────────────────────────────────────────────
  morgana: {
    main: [
      { qty: 4, card: {
        id: "morgana-sr", name: "Morgana Pendragon", image: "/images/morgana-20sr.png",
        rarity: "SR", type: "unit", element: "Darkus", dp: 2,
        ability: "Acorde do Abismo",
        abilityDescription: "Toda vez que Morgana causa dano a um oponente diretamente, ela drena uma pequena quantidade de vida (1DP) para a vida do jogador. Se o oponente tiver uma unidade do elemento Luz em campo, a drenagem é dobrada (2DP).",
        attack: "Ressonância em Eclipse",
        attackDescription: "Se a unidade ou o oponente sobreviver a este ataque, ele fica impedido de sacar cartas ou ativar habilidades no próximo turno dele, esse efeito pode ser ativado a cada 2 turnos.",
        category: "Darkness Ultimate Gear user",
      }},
      { qty: 1, card: {
        id: "morgana-ur", name: "Morgana Pendragon", image: "/images/morgana-20ur.png",
        rarity: "UR", type: "unit", element: "Darkus", dp: 3,
        ability: "Domínio Eterno",
        abilityDescription: "Enquanto essa carta estiver em campo, o oponente não pode ativar cartas armadilhas. Se essa carta for removida do campo, o oponente perde 3PV",
        attack: "Sinfonia Relâmpago",
        attackDescription: "A cada 3 turnos ela pode destruir duas cartas de Action ou Armadilhas Correntes do oponente. Para cada carta destruída por este efeito, o oponente deve descartar as 3 cartas do topo do deck dele diretamente para o cemitério.",
        category: "Darkness Ultimate Gear user",
      }},
      { qty: 2, card: CHAMADO_DA_TAVOLA },
      { qty: 1, card: {
        id: "oswin-r", name: "Oswin: O Comerciante", image: "/images/oswin-20r.png",
        rarity: "R", type: "unit", element: "Darkus", dp: 1,
        ability: "Lucro na Crise",
        abilityDescription: "Puxe 5 cartas do seu baralho, se tiver cartas de itens, escolha até duas dessas cartas para adiciona-las a sua mão, o resto das cartas você irá deixa-las abaixo do seu baralho, sendo elas as ultimas a serem compradas, Caso não tenha, escolha 1 carta dessas. Essa habilidade só pode ser ativada uma vez por duelo.",
        attack: "Arremesso de Mercadorias", category: "Darkness Troops unit",
      }},
      { qty: 1, card: {
        id: "merlin-r", name: "Merlin: O Mago do Destino", image: "/images/merlin-20r.png",
        rarity: "R", type: "unit", element: "Darkus", dp: 1,
        ability: "Visão Além do Agora",
        abilityDescription: "Puxe 5 cartas do seu baralho, escolha duas dessas cartas para adiciona-las a sua mão, o resto das cartas você irá deixa-las abaixo do seu baralho, sendo elas as ultimas a serem compradas. Essa habilidade só pode ser ativada uma vez por duelo.",
        attack: "Feitiço da Eternidade", category: "Darkness Troops unit",
      }},
      { qty: 1, card: RUINAS_ABANDONADAS },
      { qty: 2, card: DADOS_DO_DESTINO },
      { qty: 2, card: AMPLIFICADOR_DE_PODER },
      { qty: 2, card: BANDAGEM_RESTAURADORA },
      { qty: 2, card: BRINCADEIRA_DE_MAU_GOSTO },
      { qty: 1, card: A_GRANDE_ORDEM },
      { qty: 1, card: LACOS_DA_ORDEM },
    ],
    tap: [
      { qty: 1, card: {
        id: "twiligh-avalon", name: "Ultimate Gear: Twiligh Avalon", image: "/images/twiligh-20avalon.png",
        rarity: "UR", type: "ultimateGear", element: "Darkus", dp: 0,
        ability: "TWILIGH AVALON",
        abilityDescription: "Quando equipada em Morgana, a Twiligh Avalon concede os seguintes efeitos: Morgana ganha +2DP, Você pode selecionar e devolver 1 Card do campo do seu oponente para a mão dele, Se o Card devolvido for uma unidade, cause 3DP de dano direto aos LP do oponente, essa segunda habilidade pode ser ativada somente uma única vez.",
        attack: "", category: "Darkness Ultimate Gear", requiresUnit: "Morgana Pendragon",
      }},
      { qty: 1, card: {
        id: "sinfonia-relampago", name: "Sinfonia Relâmpago", image: "/images/cards/sinfonia-relampago.png",
        rarity: "UR", type: "magic", element: "Darkus", dp: 0,
        ability: "Ataque Especial de Morgana",
        abilityDescription: "Se estiver com Morgana Pendragon em seu campo de batalha, use essa carta e cause 4DP diretamente no seu oponente, essa carta não pode ser negada por armadilhas do seu oponente.",
        attack: "", category: "Magic Funcion Card", requiresUnit: "morgana",
      }},
    ],
  },

  // ── Calem Hidenori — Void ────────────────────────────────────────────────────
  calem: {
    main: [
      { qty: 4, card: {
        id: "calem-sr", name: "Calem Hidenori", image: "/images/cards/calem-sr.png",
        rarity: "SR", type: "ultimateElemental", element: "Void", dp: 2,
        ability: "Vácuo de Essência",
        abilityDescription: "Sempre que Calem destruir uma unidade do oponente em batalha, cause 1DP de dano direto aos LP do oponente.",
        attack: "Pulso da Nulidade",
        attackDescription: "Ao atacar: compre uma carta. Se for uma carta de Unidade de Tropas do Elemento Void, ele ganha +1DP até o final da fase de batalha. Esse efeito pode ser ativado a cada 3 Turnos.",
        category: "Void Ultimate Elemental user",
      }},
      { qty: 1, card: {
        id: "calem-ur", name: "Calem Hidenori", image: "/images/cards/calem-ur.png",
        rarity: "UR", type: "ultimateElemental", element: "Void", dp: 3,
        ability: "Horizonte de Eventos",
        abilityDescription: "Sempre que este personagem destruir uma unidade do oponente em batalha, ele recebe +2DP até o final do turno.",
        attack: "Impacto sem Fé",
        attackDescription: "Ao declarar um ataque: compre 1 carta. Se for uma Unidade, este personagem pode atacar novamente. Esse efeito pode ser ativado a cada 3 Turnos.",
        category: "Void Ultimate Elemental user",
      }},
      { qty: 2, card: CHAMADO_DA_TAVOLA },
      { qty: 1, card: {
        id: "balin-r", name: "Balin: O Sentinela das Ruínas", image: "/images/cards/Balin_R.png",
        rarity: "R", type: "troops", element: "Void", dp: 1,
        ability: "Vigília Eterna",
        abilityDescription: "Quando esta carta entrar em campo, olhe as 3 cartas do topo do seu deck, adicione 1 à sua mão e coloque o restante no fundo do deck.",
        attack: "Lâmina de Poeira e Vácuo", category: "Void Troops unit",
      }},
      { qty: 1, card: {
        id: "lancelot-r", name: "Lancelot: O Herdeiro Sagrado", image: "/images/cards/Lancelot_R.png",
        rarity: "R", type: "troops", element: "Void", dp: 1,
        ability: "Virtude do Cavaleiro",
        abilityDescription: "Se você controlar qualquer Unidade de Elemento Void no seu campo, Lancelot ganha +2DP. Quando esta carta é destruída, você pode recuperar uma carta Funcion do seu cemitério e colocá-la na sua mão.",
        attack: "Impacto da Coroa", category: "Void Troops unit",
      }},
      { qty: 1, card: RUINAS_ABANDONADAS },
      { qty: 2, card: DADOS_DO_DESTINO },
      { qty: 2, card: AMPLIFICADOR_DE_PODER },
      { qty: 2, card: BANDAGEM_RESTAURADORA },
      { qty: 2, card: BRINCADEIRA_DE_MAU_GOSTO },
      { qty: 1, card: A_GRANDE_ORDEM },
      { qty: 1, card: LACOS_DA_ORDEM },
    ],
    tap: [
      { qty: 1, card: {
        id: "miguel-arcanjo", name: "Ultimate Guardian: Miguel Arcanjo", image: "/images/cards/miguel-arcanjo.png",
        rarity: "UR", type: "ultimateGear", element: "Haos", dp: 0,
        ability: "MIGUEL ARCANJO",
        abilityDescription: "Quando está equipado em Calem Hidenori, ele concede os seguintes efeitos: Calem Hidenori ganha +4DP. Enquanto este Card estiver equipado, Calem Hidenori não pode ser alvo ou destruído por efeitos de Cards de Função do oponente. Julgamento Divino: Uma vez por turno, você pode selecionar uma Unidade no campo do oponente e diminuir -1DP.",
        attack: "", category: "Haos Ultimate Guardian", requiresUnit: "Calem Hidenori",
      }},
      { qty: 1, card: {
        id: "julgamento-do-vazio-eterno", name: "Julgamento do Vazio Eterno", image: "/images/cards/Julgamento_do_Vazio_Eterno.png",
        rarity: "UR", type: "magic", element: "Haos", dp: 0,
        ability: "Ataque Especial de Calem",
        abilityDescription: "Se estiver com Calem Hidenori em seu campo de batalha, use essa carta e cause 5DP em alguma unidade do seu oponente ou diretamente no LP dele.",
        attack: "", category: "Magic Funcion Card", requiresUnit: "calem",
      }},
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildStarterDeckGrant — gera instâncias ÚNICAS de cada carta (mesmo padrão de
// ID usado pelo resto do jogo: `${templateId}-${timestamp}-tag-${index}`) prontas
// para serem passadas para useGame().addToCollection() e useGame().saveDeck().
// Chamada pelo game-wrapper.tsx em handleTutorialComplete.
// ═══════════════════════════════════════════════════════════════════════════════

export interface StarterDeckGrant {
  collectionCards: GameCard[]  // todas as 22 cópias — vão pra Coleção do jogador
  mainDeckCards:   GameCard[]  // 20 cópias — vão para Deck.cards
  tapDeckCards:    GameCard[]  // 2 cópias  — vão para Deck.tapCards
}

export function buildStarterDeckGrant(masterId: TutorialMasterId): StarterDeckGrant {
  const deck = STARTER_DECKS[masterId]
  const ts = Date.now()
  let counter = 0

  const collectionCards: GameCard[] = []
  const mainDeckCards: GameCard[] = []
  const tapDeckCards: GameCard[] = []

  const expand = (entries: DeckEntry[], target: GameCard[]) => {
    entries.forEach(({ card, qty }) => {
      for (let copy = 0; copy < qty; copy++) {
        counter++
        // Padrão de ID de coleção igual ao usado no gacha-screen.tsx:
        // `${templateId}-${timestamp}-tag-${index}` — os 2 últimos segmentos são
        // removidos pelo collection-screen.tsx para agrupar cópias da mesma carta.
        const collectionId = `${card.id}-${ts}-starter-${counter}`
        const collectionCard: GameCard = { ...card, id: collectionId }
        collectionCards.push(collectionCard)
        // Padrão de ID de deck igual ao usado no deck-builder-screen.tsx:
        // `${collectionCardId}-deck-${timestamp}`
        const deckCard: GameCard = { ...collectionCard, id: `${collectionId}-deck-${ts}` }
        target.push(deckCard)
      }
    })
  }

  expand(deck.main, mainDeckCards)
  expand(deck.tap, tapDeckCards)

  return { collectionCards, mainDeckCards, tapDeckCards }
}

// LORE SLIDES  (breves + humanizados)
// ═══════════════════════════════════════════════════════════════════════════════

interface LoreSlide {
  bg: string; speakerName: string; speakerColor: string; text: string
  leftChar?: TutorialMasterId | null; rightChar?: TutorialMasterId | null
  isNarrator?: boolean; tag?: string
}

function buildLoreSlides(playerName: string): LoreSlide[] {
  const pn = playerName || "Viajante"
  return [
    {
      bg: "radial-gradient(ellipse at 50% 30%, #0a1628 0%, #020307 100%)",
      speakerName: "Narrador", speakerColor: "#fbbf24", isNarrator: true,
      tag: "A Grande Ordem",
      text: "Em um lugar distante no mundo, três jovens seguiam suas vidas juntos, deixando o destino os levar...",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "???", speakerColor: "#94a3b8",
      tag: "Mundo — sob os céus abertos",
      text: "Para onde iremos agora?",
      leftChar: "calem",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "???", speakerColor: "#38bdf8",
      text: "Temos que deixar o destino nos levar.",
      leftChar: "fehnon",
    },
    {
      bg: "linear-gradient(160deg, #0d0520 0%, #1a0838 60%, #0d0520 100%)",
      speakerName: "???", speakerColor: "#a855f7",
      text: "Mas de qualquer forma, nós vamos seguir juntos! Somos a Grande Ordem, lembra? O destino sempre nos guiará.",
      leftChar: "calem", rightChar: "morgana",
    },
    {
      bg: "radial-gradient(ellipse at 50% 80%, #0b1428 0%, #020307 100%)",
      speakerName: "???", speakerColor: "#94a3b8",
      text: "ESPERA! Tem alguém CAINDO do céu ali! Precisamos ir AGORA!",
      leftChar: "calem", rightChar: "fehnon",
    },
    {
      bg: "radial-gradient(ellipse at 50% 50%, #080a10 0%, #010203 100%)",
      speakerName: pn, speakerColor: "#e2e8f0",
      text: "O que?... Onde... Onde estou?...",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "Fehnon Hoskie", speakerColor: "#38bdf8",
      text: `Ufa, você acordou! Eu sou Fehnon Hoskie. Ela é Morgana, e ele é Calem Hidenori. Bem-vindo(a), ${pn}!`,
      leftChar: "fehnon", rightChar: "morgana",
    },
    {
      bg: "radial-gradient(ellipse at 50% 50%, #080a10 0%, #010203 100%)",
      speakerName: pn, speakerColor: "#e2e8f0",
      text: "Eu... não me lembro de nada. É como se tivesse batido a cabeça.",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "Fehnon Hoskie", speakerColor: "#38bdf8",
      text: "Este mundo é perigoso. Aqui alguns possuem poderes chamados Ultimates — cada um escolhe usá-los para o bem ou para o mal. Mas você não estará sozinho(a).",
      leftChar: "fehnon",
    },
    {
      bg: "linear-gradient(160deg, #0d0520 0%, #1a0838 60%, #0d0520 100%)",
      speakerName: "Fehnon Hoskie", speakerColor: "#38bdf8",
      text: "Venha conosco nessa jornada! E se quiser aprender sobre as Ultimates... escolha um de nós para ser seu Mestre de Jornada.",
      leftChar: "fehnon", rightChar: "morgana",
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERLAY TUTORIAL STEPS  (texto do balão sobre as telas REAIS)
// ═══════════════════════════════════════════════════════════════════════════════

// ── MENU pré-duelo: apenas o JOGAR (clique obrigatório no botão real)
// interceptClick: true → o clique só avança via DynamicSpotlight interceptor,
// o botão do balão fica visualmente desabilitado e não faz nada.
const MENU_STEPS = [
  { text: "Este é o botão JOGAR! Para começar sua primeira batalha, clique diretamente nele!",
    textTarget: "JOGAR", interceptClick: true },
]

// ── Pós-duelo: volta ao menu e obriga a clicar no GACHA
const POST_DUEL_STEPS = [
  { text: "Parabéns pelo duelo! Agora clique em GACHA para abrir seu primeiro pack de cartas!",
    textTarget: "GACHA", interceptClick: true },
]

const GACHA_STEPS = [
  { text: "Hora da recompensa! Este pack veio de graça só por ser seu primeiro dia aqui. Vamos abrir!",
    textTarget: null },
  { text: "Clique para abrir! Quem sabe que cartas raras vão aparecer para você...",
    textTarget: "GACHA x1" },
  // Passo "fantasma": sem balão, sem escurecimento — a animação real do pack
  // roda limpa, sem nenhuma interferência visual do tutorial.
  { text: "", textTarget: null, hidden: true, autoAdvanceMs: 4200 },
  { text: "Incrível! Você conseguiu suas primeiras cartas! Continue jogando e abrindo packs — há muito mais pela frente. Obrigado(a) por me deixar te ensinar como tudo funciona. Agora... divirta-se e aproveite tudo que o jogo tem para te oferecer!",
    textTarget: null },
]

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: TYPEWRITER (digita letra por letra)
// ═══════════════════════════════════════════════════════════════════════════════

function useTypewriter(text: string, speedMs = 28) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)
  const textRef = useRef(text)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    textRef.current = text

    const interval = setInterval(() => {
      indexRef.current += 1
      setDisplayed(textRef.current.slice(0, indexRef.current))
      if (indexRef.current >= textRef.current.length) {
        setDone(true)
        clearInterval(interval)
      }
    }, speedMs)

    return () => clearInterval(interval)
  }, [text, speedMs])

  /** Pula direto para o texto completo */
  const skip = useCallback(() => {
    indexRef.current = textRef.current.length
    setDisplayed(textRef.current)
    setDone(true)
  }, [])

  return { displayed, done, skip }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: TUTORIAL AUDIO (fade in/out)
// ═══════════════════════════════════════════════════════════════════════════════

function useTutorialAudio(src: string, volume = 0.5) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = 0
    audioRef.current = audio

    // Fade in
    audio.play().catch(() => {})
    let vol = 0
    const fadeIn = setInterval(() => {
      vol = Math.min(volume, vol + 0.02)
      audio.volume = vol
      if (vol >= volume) clearInterval(fadeIn)
    }, 60)

    return () => {
      clearInterval(fadeIn)
      // Fade out
      let v = audio.volume
      const fadeOut = setInterval(() => {
        v = Math.max(0, v - 0.03)
        audio.volume = v
        if (v <= 0) { audio.pause(); clearInterval(fadeOut) }
      }, 40)
    }
  }, [src, volume])
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MASTER BUBBLE (balão de fala branco — fiel ao in-game)
// ═══════════════════════════════════════════════════════════════════════════════

function MasterBubble({ masterId, text, onNext, nextLabel = "Continuar ►" }: {
  masterId: TutorialMasterId; text: string; onNext: () => void; nextLabel?: string
}) {
  const m = MASTERS[masterId]
  return (
    <div style={{
      position: "fixed", bottom: 0, right: 0,
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      zIndex: 600, pointerEvents: "none",
      width: "clamp(240px, 27vw, 370px)",
    }}>
      {/* Balão */}
      <div style={{
        position: "relative", background: "white", borderRadius: 14,
        padding: "14px 16px",
        marginRight: 88, marginBottom: 10,
        width: "calc(100% - 98px)",
        boxShadow: `0 6px 30px rgba(0,0,0,0.55), 0 0 0 2px ${m.color}35`,
        pointerEvents: "all",
      }}>
        {/* Sombra da cauda */}
        <div style={{
          position: "absolute", bottom: -17, right: 28,
          borderLeft: "16px solid transparent", borderRight: "16px solid transparent",
          borderTop: `17px solid ${m.color}30`, zIndex: -1,
        }} />
        {/* Cauda branca */}
        <div style={{
          position: "absolute", bottom: -13, right: 30,
          borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
          borderTop: "14px solid white",
        }} />
        <div style={{
          fontSize: 10, fontWeight: 800, color: m.color,
          fontFamily: "'Segoe UI', sans-serif",
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
        }}>
          {m.name}
        </div>
        <p style={{
          fontFamily: "'Segoe UI', sans-serif",
          fontSize: "clamp(12px, 1.25vw, 14px)",
          color: "#1e293b", lineHeight: 1.6, margin: "0 0 12px", fontWeight: 500,
        }}>
          {text}
        </p>
        <button onClick={onNext} style={{
          display: "block", marginLeft: "auto",
          background: m.color, color: "white", border: "none",
          borderRadius: 8, padding: "6px 16px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          letterSpacing: "0.04em", fontFamily: "'Segoe UI', sans-serif",
          boxShadow: `0 2px 10px ${m.shadowGlow}`,
        }}>
          {nextLabel}
        </button>
      </div>
      {/* Arte do Mestre */}
      <img src={m.art} alt={m.name} style={{
        width: 94, height: 158,
        objectFit: "contain", objectPosition: "bottom center",
        filter: `drop-shadow(0 0 22px ${m.shadowGlow})`,
        flexShrink: 0,
      }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: REGION SPOTLIGHT (spotlight baseado em coordenadas % da tela)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helpers de busca no DOM real ────────────────────────────────────────────
type PixelRect = { x: number; y: number; w: number; h: number }

/** Remove acentos e normaliza para comparação */
const normText = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()

/**
 * Encontra o menor elemento que contém exatamente `target` como texto visível.
 * Retorna o BoundingClientRect com padding.
 */
function findByText(target: string, pad = 10): PixelRect | null {
  const tNorm = normText(target)
  let best: Element | null = null
  let bestArea = Infinity

  document.querySelectorAll("button, a, div, span, p").forEach(el => {
    const elText = normText(el.textContent ?? "")
    // Contém o alvo e não é muito maior que ele (evita pegar container pai)
    if (elText.includes(tNorm) && elText.length <= tNorm.length * 5) {
      const r = el.getBoundingClientRect()
      const area = r.width * r.height
      if (r.width > 10 && r.height > 8 && r.top >= 0 && area < bestArea) {
        best = el
        bestArea = area
      }
    }
  })

  if (!best) return null
  const r = (best as Element).getBoundingClientRect()
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
}

/**
 * Caso especial "__SIDEBAR__": encontra todos os botões laterais pelo texto
 * e retorna um rect que envolve todos eles.
 */
function findSidebar(pad = 6): PixelRect | null {
  const LABELS = ["DECK", "MESTRE", "CONFIG", "CONF", "TEMA", "LOJA", "DIAR", "HISTO", "HISTÓ"]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let found = 0

  document.querySelectorAll("div, span, button").forEach(el => {
    const t = normText(el.textContent ?? "")
    if (LABELS.some(l => t === l || t.startsWith(l)) ) {
      const r = el.getBoundingClientRect()
      // Apenas elementos pequenos (botões de sidebar, não containers)
      if (r.width > 0 && r.width < 130 && r.height > 0 && r.height < 130) {
        minX = Math.min(minX, r.left)
        minY = Math.min(minY, r.top)
        maxX = Math.max(maxX, r.right)
        maxY = Math.max(maxY, r.bottom)
        found++
      }
    }
  })

  if (found === 0) return null
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}

// ─── DynamicSpotlight ─────────────────────────────────────────────────────────
/**
 * Spotlight que encontra o elemento pelo texto no DOM real —
 * funciona em qualquer resolução sem coordenadas hardcoded.
 */
function DynamicSpotlight({ textTarget, onInterceptClick }: {
  textTarget: string | null
  /** Quando definido, captura o clique sobre o alvo ANTES que ele chegue no
   *  botão real por baixo — usado pro JOGAR pular a navegação real do jogo
   *  e ir direto pro duelo roteirizado do tutorial. */
  onInterceptClick?: () => void
}) {
  const [r, setR] = useState<PixelRect | null>(null)

  useEffect(() => {
    if (!textTarget) { setR(null); return }

    const update = () => {
      const found =
        textTarget === "__SIDEBAR__" ? findSidebar() : findByText(textTarget)
      setR(found)
    }

    update()
    const t = setInterval(update, 350)
    window.addEventListener("resize", update)
    return () => { clearInterval(t); window.removeEventListener("resize", update) }
  }, [textTarget])

  // Sem alvo: escurece a tela inteira
  if (!textTarget || !r) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.62)", zIndex: 400, pointerEvents: "none",
      }} />
    )
  }

  const { x, y, w, h } = r

  return (
    <>
      <svg style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 400, pointerEvents: "none", overflow: "visible",
      }}>
        <defs>
          <mask id="dyn-spl">
            <rect width="100%" height="100%" fill="white" />
            {/* Buraco no overlay: coordenadas em px vindas do getBoundingClientRect */}
            <rect x={x} y={y} width={w} height={h} rx={10} fill="black" />
          </mask>
        </defs>
        {/* Overlay escuro com buraco */}
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#dyn-spl)" />
        {/* Anel pulsante ao redor do elemento */}
        <rect
          x={x - 3} y={y - 3} width={w + 6} height={h + 6}
          rx={13} fill="none"
          stroke="rgba(255,255,255,0.55)" strokeWidth="2.5"
          style={{ animation: "tutRingPulse 1.6s ease-in-out infinite" }}
        />
        <rect
          x={x - 7} y={y - 7} width={w + 14} height={h + 14}
          rx={16} fill="none"
          stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
          style={{ animation: "tutRingPulse 1.6s ease-in-out infinite 0.3s" }}
        />
      </svg>
      {/* Captador de clique transparente — fica ACIMA do botão real, então o
          clique nunca chega nele. Só existe quando onInterceptClick é dado.
          IMPORTANTE: pointerEvents "all" sobrescreve o "none" do container pai. */}
      {onInterceptClick && (
        <div
          onClick={onInterceptClick}
          style={{
            position: "fixed", left: x, top: y, width: w, height: h,
            zIndex: 401, cursor: "pointer", borderRadius: 10,
            pointerEvents: "all",
          }}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: LORE PHASE
// ═══════════════════════════════════════════════════════════════════════════════

function LorePhase({ slides, currentSlide, onAdvance, onSkip }: {
  slides: LoreSlide[]; currentSlide: number; onAdvance: () => void; onSkip: () => void
}) {
  const slide = slides[currentSlide]
  const { displayed, done, skip } = useTypewriter(slide.text, 28)
  useTutorialAudio("/audio/Solidificação.mp3", 0.45)

  // Slide 6 = "Ufa, você acordou!" — primeira apresentação real dos personagens.
  // Antes disso as artes aparecem como silhuetas escuras e misteriosas.
  const REVEAL_SLIDE = 6
  const isRevealed = currentSlide >= REVEAL_SLIDE

  const isLast = currentSlide === slides.length - 1

  const handleClick = () => {
    if (!done) { skip(); return }
    onAdvance()
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: slide.bg,
      cursor: "pointer", userSelect: "none",
      transition: "background 0.65s ease",
    }} onClick={handleClick}>
      {/* Fundo estrelado */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.65) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 75% 14%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
          "radial-gradient(1.5px 1.5px at 48% 62%, rgba(255,255,255,0.55) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 91% 73%, rgba(255,255,255,0.45) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 28% 88%, rgba(255,255,255,0.35) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 62% 38%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 38% 5%, rgba(255,255,255,0.4) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Sprite esquerdo */}
      {slide.leftChar && (
        <div key={`L${currentSlide}`} style={{
          position: "absolute", left: 0, bottom: 128,
          height: "clamp(270px, 57vh, 500px)",
          animation: "tutSlideLeft 0.4s ease both", pointerEvents: "none",
        }}>
          <img src={MASTERS[slide.leftChar].art} alt="" style={{
            height: "100%", objectFit: "contain", objectPosition: "bottom",
            filter: isRevealed
              ? "drop-shadow(0 8px 32px rgba(0,0,0,0.75))"
              : "brightness(0.07) saturate(0.1) contrast(1.15)",
            transition: isRevealed ? "filter 1.4s ease" : "filter 0.3s ease",
          }} />
        </div>
      )}

      {/* Sprite direito (espelhado) */}
      {slide.rightChar && (
        <div key={`R${currentSlide}`} style={{
          position: "absolute", right: 0, bottom: 128,
          height: "clamp(270px, 57vh, 500px)",
          transform: "scaleX(-1)",
          animation: "tutSlideRight 0.4s ease both", pointerEvents: "none",
        }}>
          <img src={MASTERS[slide.rightChar].art} alt="" style={{
            height: "100%", objectFit: "contain", objectPosition: "bottom",
            filter: isRevealed
              ? "drop-shadow(0 8px 32px rgba(0,0,0,0.75))"
              : "brightness(0.07) saturate(0.1) contrast(1.15)",
            transition: isRevealed ? "filter 1.4s ease" : "filter 0.3s ease",
          }} />
        </div>
      )}

      {/* Tag de capítulo/local */}
      {slide.tag && (
        <div style={{
          position: "absolute", top: 16, left: 16,
          background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "5px 14px",
          color: "rgba(255,255,255,0.45)", fontSize: 11,
          fontFamily: "'Segoe UI', sans-serif", fontStyle: "italic",
          zIndex: 10, display: "flex", alignItems: "center", gap: 6,
        }}>
          {slide.isNarrator ? "📖" : "📍"} {slide.tag}
        </div>
      )}

      {/* Pontos de progresso */}
      <div style={{
        position: "absolute", top: 20, right: 88,
        display: "flex", gap: 5, zIndex: 10, pointerEvents: "none",
      }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === currentSlide ? 18 : 5, height: 5, borderRadius: 3,
            background: i === currentSlide ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Botão Pular */}
      <button onClick={e => { e.stopPropagation(); onSkip() }} style={{
        position: "absolute", top: 14, right: 16,
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)",
        color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "6px 14px",
        fontSize: 13, cursor: "pointer", zIndex: 10,
        fontFamily: "'Segoe UI', sans-serif", backdropFilter: "blur(4px)",
        letterSpacing: "0.04em",
      }}>
        ⏭ Pular
      </button>

      {/* Caixa de diálogo */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(3,4,10,0.93)", borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "18px 24px 26px", minHeight: 128,
      }} onClick={e => e.stopPropagation()}>
        {/* Badge do orador */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${slide.speakerColor}16`,
          border: `1px solid ${slide.speakerColor}50`,
          color: slide.speakerColor,
          fontFamily: "'Segoe UI', sans-serif", fontWeight: 700, fontSize: 12,
          padding: "3px 14px", borderRadius: 20, marginBottom: 10, letterSpacing: "0.04em",
        }}>
          {slide.isNarrator ? "📖" : "💬"} {slide.speakerName}
        </div>

        {/* Texto com typewriter — clique para pular */}
        <p style={{
          fontFamily: "'Segoe UI', sans-serif",
          fontSize: "clamp(14px, 1.85vw, 17px)",
          color: "#f0f9ff", lineHeight: 1.68, margin: 0, fontWeight: 400,
          minHeight: "2.5em",
        }}>
          {displayed}
          {/* Cursor piscante enquanto digita */}
          {!done && (
            <span style={{ animation: "tutCursor 0.7s step-end infinite", opacity: 1 }}>|</span>
          )}
        </p>

        <button onClick={e => { e.stopPropagation(); handleClick() }} style={{
          position: "absolute", bottom: 20, right: 24,
          background: "transparent", border: "1px solid rgba(255,255,255,0.22)",
          color: "rgba(255,255,255,0.55)", borderRadius: 8, padding: "5px 18px",
          fontSize: 12, cursor: "pointer",
          fontFamily: "'Segoe UI', sans-serif", letterSpacing: "0.04em",
        }}>
          {!done ? "Pular texto ►" : isLast ? "Escolher Mestre ►" : "Avançar ►"}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MASTER SELECT PHASE
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: DECK CARD TILE  (representação visual compacta de uma carta)
// ═══════════════════════════════════════════════════════════════════════════════

// Raridades reais do jogo: R, SR, UR, LR (não existe "Common" no Gear Perks)
const RARITY_COLORS: Record<string, string> = {
  LR: "#f87171", UR: "#fbbf24", SR: "#c084fc", R: "#60a5fa",
}

function DeckCardTile({ card, qty }: { card: GameCard; qty: number }) {
  const rc = RARITY_COLORS[card.rarity] ?? "#94a3b8"
  const isShiny = card.rarity === "UR" || card.rarity === "SR" || card.rarity === "LR"
  return (
    <div style={{
      position: "relative",
      aspectRatio: "0.72",
      borderRadius: 9,
      overflow: "hidden",
      background: "#0a0a14",
      border: `1.5px solid ${rc}${isShiny ? "70" : "38"}`,
      boxShadow: isShiny ? `0 0 14px ${rc}28, 0 4px 10px rgba(0,0,0,0.6)` : "0 2px 8px rgba(0,0,0,0.5)",
      cursor: "default",
    }}>
      {/* Arte real da carta */}
      <img
        src={card.image}
        alt={card.name}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
          display: "block",
        }}
      />

      {/* Gradiente sutil na base para legibilidade dos badges */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 30%, transparent 65%, rgba(0,0,0,0.1) 100%)",
        pointerEvents: "none",
      }} />

      {/* Badge de raridade — canto superior esquerdo */}
      <div style={{
        position: "absolute", top: 4, left: 4,
        fontSize: "clamp(6px, 0.68vw, 8px)", fontWeight: 800,
        color: rc,
        background: "rgba(4,4,10,0.82)",
        border: `1px solid ${rc}60`,
        padding: "1px 5px", borderRadius: 4,
        letterSpacing: "0.04em",
        backdropFilter: "blur(3px)",
        lineHeight: "1.6",
      }}>
        {card.rarity}
      </div>

      {/* Badge de quantidade — canto superior direito */}
      {qty > 1 && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          fontSize: "clamp(7px, 0.72vw, 9px)", fontWeight: 800,
          color: "#fff",
          background: "rgba(4,4,10,0.82)",
          padding: "1px 5px", borderRadius: 4,
          backdropFilter: "blur(3px)",
          lineHeight: "1.6",
        }}>
          ×{qty}
        </div>
      )}

      {/* Anel brilhante para UR */}
      {card.rarity === "UR" && (
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: 8,
          boxShadow: `inset 0 0 0 1.5px ${rc}55`,
          pointerEvents: "none",
        }} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: STARTER DECK MODAL  (preview do Deck Inicial de um Mestre)
// ═══════════════════════════════════════════════════════════════════════════════

function StarterDeckModal({ masterId, onClose }: { masterId: TutorialMasterId; onClose: () => void }) {
  const m = MASTERS[masterId]
  const deck = STARTER_DECKS[masterId]
  const totalMain = deck.main.reduce((s, entry) => s + entry.qty, 0)
  const totalTap = deck.tap.reduce((s, entry) => s + entry.qty, 0)

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(2,2,6,0.82)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(10px, 3vh, 30px)",
        animation: "tutFadeIn 0.22s ease both",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0a0a12", borderRadius: 18,
          border: `1px solid ${m.color}35`,
          width: "100%", maxWidth: 760, maxHeight: "88vh",
          overflowY: "auto", overflowX: "hidden",
          boxShadow: `0 0 70px ${m.color}22, 0 24px 70px rgba(0,0,0,0.65)`,
          animation: "msDeckModalIn 0.32s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 5,
          background: `linear-gradient(135deg, ${m.color}1c 0%, #0a0a12 85%)`,
          borderBottom: `1px solid ${m.color}28`,
          padding: "clamp(14px, 2.6vw, 22px) clamp(16px, 3vw, 26px)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{
              fontSize: "clamp(8px, 0.85vw, 10px)", color: `${m.color}dd`,
              letterSpacing: "0.24em", fontWeight: 800, textTransform: "uppercase", marginBottom: 5,
            }}>
              {m.name} · {m.deckName}
            </div>
            <div style={{ fontSize: "clamp(17px, 2.4vw, 24px)", fontWeight: 900, color: "#fff" }}>
              🃏 Deck Inicial
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.65)", fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)" }}
          >
            ✕
          </button>
        </div>

        {/* ── Corpo ── */}
        <div style={{ padding: "clamp(14px, 2.6vw, 24px)" }}>
          {/* Deck Principal */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "clamp(10px, 1.8vh, 14px)" }}>
            <span style={{ fontSize: 15 }}>⚔️</span>
            <span style={{ fontSize: "clamp(12px, 1.4vw, 15px)", fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
              Deck Principal
            </span>
            <span style={{ fontSize: "clamp(10px, 1.1vw, 12px)", color: "rgba(255,255,255,0.32)", fontWeight: 600 }}>
              ({totalMain} cartas)
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))",
            gap: "clamp(6px, 1vw, 10px)",
          }}>
            {deck.main.map((entry, i) => <DeckCardTile key={i} card={entry.card} qty={entry.qty} />)}
          </div>

          {/* TAP — Extra Deck */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "clamp(16px, 2.8vh, 24px) 0 clamp(10px, 1.8vh, 14px)" }}>
            <span style={{ fontSize: 15 }}>🌀</span>
            <span style={{ fontSize: "clamp(12px, 1.4vw, 15px)", fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
              TAP — Extra Deck
            </span>
            <span style={{ fontSize: "clamp(10px, 1.1vw, 12px)", color: "rgba(255,255,255,0.32)", fontWeight: 600 }}>
              ({totalTap} cartas)
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))",
            gap: "clamp(6px, 1vw, 10px)",
            maxWidth: 320,
          }}>
            {deck.tap.map((entry, i) => <DeckCardTile key={i} card={entry.card} qty={entry.qty} />)}
          </div>

          {/* Nota explicativa */}
          <div style={{
            marginTop: "clamp(16px, 2.8vh, 22px)",
            padding: "clamp(11px, 1.8vh, 15px) clamp(13px, 2.2vw, 18px)",
            background: `${m.color}0e`, border: `1px solid ${m.color}28`,
            borderRadius: 11, textAlign: "center",
            fontSize: "clamp(10px, 1vw, 12px)", color: "rgba(255,255,255,0.55)", lineHeight: 1.65,
          }}>
            ✨ Ao escolher <strong style={{ color: m.color }}>{m.name}</strong> como seu Mestre, este deck completo
            ({totalMain + totalTap} cartas) será adicionado automaticamente à sua conta como{" "}
            <strong style={{ color: "#fff" }}>"Deck Inicial"</strong> e já estará pronto pra batalha no Main Menu.
          </div>
        </div>
      </div>
    </div>
  )
}

function MasterSelectPhase({ playerName, onSelect, selectedMaster, confirmed }: {
  playerName: string; onSelect: (id: TutorialMasterId) => void
  selectedMaster: TutorialMasterId | null; confirmed: boolean
}) {
  const [hovered, setHovered] = useState<TutorialMasterId | null>(null)
  const [entered, setEntered] = useState(false)
  const [viewingDeck, setViewingDeck] = useState<TutorialMasterId | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useTutorialAudio("/audio/Big Memory.mp3", 0.5)

  useEffect(() => { const t = setTimeout(() => setEntered(true), 80); return () => clearTimeout(t) }, [])

  const handleEnter = (id: TutorialMasterId) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(id)
  }
  const handleLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHovered(null), 130)
  }

  // ── CONFIRMAÇÃO ──────────────────────────────────────────────────────────────
  if (confirmed && selectedMaster) {
    const m = MASTERS[selectedMaster]
    const [cfGiven, ...cfFamily] = m.name.split(" ")
    return (
      <div style={{ position:"fixed", inset:0, background:"#050508", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 65%, ${m.color}26 0%, transparent 58%)`, animation:"msConfirmBg 0.8s ease both" }} />
        <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 65%, ${m.color}0e 0%, transparent 88%)`, animation:"msConfirmBg 1.3s ease 0.1s both" }} />
        <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:"140%", height:"100%", background:`conic-gradient(from 260deg at 50% 120%, transparent 0deg, ${m.color}10 10deg, transparent 20deg, transparent 30deg, ${m.color}07 40deg, transparent 50deg, transparent 60deg, ${m.color}12 70deg, transparent 80deg, transparent 270deg, ${m.color}07 280deg, transparent 290deg, transparent 300deg, ${m.color}06 310deg, transparent 320deg)`, animation:"msRays 1.2s ease both" }} />
        <img src={m.art} alt={m.name} style={{ height:"clamp(280px,56vh,500px)", objectFit:"contain", filter:`drop-shadow(0 0 60px ${m.shadowGlow}) drop-shadow(0 0 120px ${m.color}22)`, animation:"msConfirmArt 0.7s cubic-bezier(0.22,1,0.36,1) both", position:"relative", zIndex:2, marginBottom:6 }} />
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, zIndex:2, animation:"tutFadeIn 0.5s ease 0.35s both", width:"clamp(220px,38vw,500px)" }}>
          <div style={{ flex:1, height:1, background:`linear-gradient(to right, transparent, ${m.color}58)` }} />
          <div style={{ width:8, height:8, background:m.color, transform:"rotate(45deg)", boxShadow:`0 0 10px ${m.color}` }} />
          <div style={{ flex:1, height:1, background:`linear-gradient(to left, transparent, ${m.color}58)` }} />
        </div>
        <div style={{ textAlign:"center", zIndex:2, animation:"tutFadeIn 0.5s ease 0.42s both" }}>
          <div style={{ fontSize:"clamp(9px,0.9vw,11px)", letterSpacing:"0.5em", color:m.color, fontWeight:700, textTransform:"uppercase", marginBottom:10, textShadow:`0 0 16px ${m.color}` }}>
            Mestre de Jornada Escolhido
          </div>
          <div style={{ fontSize:"clamp(30px,4.5vw,54px)", fontWeight:900, color:"#fff", lineHeight:1, letterSpacing:"0.05em", textTransform:"uppercase", textShadow:`0 0 40px ${m.shadowGlow}, 0 4px 20px rgba(0,0,0,0.9)` }}>{cfGiven}</div>
          {cfFamily.length > 0 && <div style={{ fontSize:"clamp(14px,1.8vw,22px)", fontWeight:400, color:`${m.color}cc`, letterSpacing:"0.3em", textTransform:"uppercase", marginBottom:14 }}>{cfFamily.join(" ")}</div>}
          <p style={{ fontSize:"clamp(13px,1.5vw,17px)", color:"rgba(255,255,255,0.6)", margin:"0 0 4px" }}>{playerName}, fico muito feliz com sua escolha!</p>
          <p style={{ fontSize:"clamp(13px,1.5vw,17px)", color:m.color, fontWeight:700, margin:0 }}>Você tem MUITO a aprender comigo daqui pra frente!</p>
        </div>
      </div>
    )
  }

  // ── SELEÇÃO ──────────────────────────────────────────────────────────────────
  const order: TutorialMasterId[] = ["morgana", "fehnon", "calem"]
  const active = hovered ?? selectedMaster

  return (
    <div style={{ position:"fixed", inset:0, background:"#050508", fontFamily:"'Segoe UI',sans-serif", overflow:"hidden" }}>

      {/* Ambient glow seguindo o personagem ativo */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        opacity: active ? 1 : 0,
        background: active ? `radial-gradient(ellipse 65% 55% at ${active==="morgana"?"17%":active==="fehnon"?"50%":"83%"} 100%, ${MASTERS[active].color}15 0%, transparent 100%)` : "transparent",
        transition:"opacity 0.65s ease, background 0.65s ease",
      }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:30, display:"flex", flexDirection:"column", alignItems:"center", padding:"clamp(16px,3vh,30px) 0 16px", background:"linear-gradient(to bottom, rgba(5,5,8,0.98) 0%, transparent 100%)", pointerEvents:"none", animation:"tutFadeIn 0.6s ease both" }}>
        <span style={{ fontSize:"clamp(7px,0.78vw,9px)", letterSpacing:"0.55em", color:"rgba(255,255,255,0.2)", textTransform:"uppercase", marginBottom:9 }}>A Grande Ordem — Sua Escolha</span>
        <h1 style={{ fontSize:"clamp(21px,2.9vw,38px)", fontWeight:900, color:"#fff", margin:"0 0 10px", letterSpacing:"0.01em", textShadow:"0 2px 30px rgba(120,60,200,0.3)" }}>Escolha seu Mestre de Jornada</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8, width:"clamp(140px,30vw,380px)" }}>
          <div style={{ flex:1, height:1, background:"linear-gradient(to right, transparent, rgba(255,255,255,0.1))" }} />
          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
            <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.2)" }} />
            <div style={{ width:5, height:5, transform:"rotate(45deg)", background:"rgba(255,255,255,0.22)" }} />
            <span style={{ fontSize:8, color:"rgba(255,255,255,0.18)", letterSpacing:"0.2em", textTransform:"uppercase" }}>Deck Inicial Exclusivo</span>
            <div style={{ width:5, height:5, transform:"rotate(45deg)", background:"rgba(255,255,255,0.22)" }} />
            <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.2)" }} />
          </div>
          <div style={{ flex:1, height:1, background:"linear-gradient(to left, transparent, rgba(255,255,255,0.1))" }} />
        </div>
      </div>

      {/* ── PAINÉIS ─────────────────────────────────────────────────────────── */}
      <div style={{ position:"absolute", top:"clamp(94px,14vh,126px)", left:0, right:0, bottom:0, display:"flex" }}>
        {order.map((id, idx) => {
          const m = MASTERS[id]
          const isActive = active === id
          const isSel = selectedMaster === id
          const isCenter = id === "fehnon"
          const [givenName, ...familyParts] = m.name.split(" ")
          const familyName = familyParts.join(" ")

          return (
            <div key={id}
              onMouseEnter={() => handleEnter(id)}
              onMouseLeave={handleLeave}
              onClick={() => onSelect(id)}
              style={{ flex:"1 0 0", position:"relative", overflow:"hidden", cursor:"pointer", transform:"translateZ(0)" }}
            >
              {/* Atmosfera própria do personagem (estática, zero custo) */}
              <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:`radial-gradient(ellipse 70% 55% at 50% 90%, ${m.color}08 0%, transparent 100%)` }} />

              {/* Intensificação no hover — só opacity */}
              <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:`linear-gradient(175deg, transparent 10%, ${m.color}0c 55%, ${m.color}1c 100%)`, opacity:isActive?1:0, willChange:"opacity", transition:"opacity 0.45s ease" }} />

              {/* Linha de borda lateral (gradiente, não 1px reto) */}
              {idx < order.length-1 && (
                <div style={{ position:"absolute", top:"5%", right:0, bottom:"5%", width:1, background:`linear-gradient(to bottom, transparent 0%, ${m.color}${isActive?"50":"1e"} 30%, ${m.color}${isActive?"50":"1e"} 70%, transparent 100%)`, transition:"background 0.45s ease", pointerEvents:"none" }} />
              )}

              {/* ── Ornamento do topo com diamante central ── */}
              <div style={{ position:"absolute", top:0, left:"8%", right:"8%", zIndex:5, pointerEvents:"none" }}>
                <div style={{ height:2, borderRadius:1, background:`linear-gradient(90deg, transparent 0%, ${m.color}${isActive?"ee":"3c"} 40%, ${m.color}ff 50%, ${m.color}${isActive?"ee":"3c"} 60%, transparent 100%)`, boxShadow:isActive?`0 0 18px 3px ${m.color}52`:"none", transition:"background 0.45s ease, box-shadow 0.45s ease" }} />
                <div style={{ position:"absolute", top:-4, left:"50%", width:10, height:10, transform:"translateX(-50%) rotate(45deg)", background:isActive?m.color:`${m.color}48`, boxShadow:isActive?`0 0 14px ${m.color}`:"none", transition:"background 0.45s ease, box-shadow 0.45s ease" }} />
                <div style={{ position:"absolute", top:-2, left:"22%", width:4, height:4, borderRadius:"50%", background:`${m.color}${isActive?"85":"28"}`, transform:"translateY(-50%)", transition:"background 0.45s ease" }} />
                <div style={{ position:"absolute", top:-2, right:"22%", width:4, height:4, borderRadius:"50%", background:`${m.color}${isActive?"85":"28"}`, transform:"translateY(-50%)", transition:"background 0.45s ease" }} />
              </div>

              {/* ── Cantos decorativos ── */}
              <div style={{ position:"absolute", top:10, left:10, width:20, height:20, pointerEvents:"none", opacity:isActive?0.92:0.2, transition:"opacity 0.4s ease" }}>
                <div style={{ position:"absolute", top:0, left:0, width:"100%", height:2, background:m.color, borderRadius:1 }} />
                <div style={{ position:"absolute", top:0, left:0, width:2, height:"100%", background:m.color, borderRadius:1 }} />
              </div>
              <div style={{ position:"absolute", top:10, right:10, width:20, height:20, pointerEvents:"none", opacity:isActive?0.92:0.2, transition:"opacity 0.4s ease" }}>
                <div style={{ position:"absolute", top:0, right:0, width:"100%", height:2, background:m.color, borderRadius:1 }} />
                <div style={{ position:"absolute", top:0, right:0, width:2, height:"100%", background:m.color, borderRadius:1 }} />
              </div>
              <div style={{ position:"absolute", bottom:"clamp(182px,26.5vh,237px)", left:10, width:14, height:14, pointerEvents:"none", opacity:isActive?0.72:0.13, transition:"opacity 0.4s ease" }}>
                <div style={{ position:"absolute", bottom:0, left:0, width:"100%", height:1.5, background:m.color }} />
                <div style={{ position:"absolute", bottom:0, left:0, width:1.5, height:"100%", background:m.color }} />
              </div>
              <div style={{ position:"absolute", bottom:"clamp(182px,26.5vh,237px)", right:10, width:14, height:14, pointerEvents:"none", opacity:isActive?0.72:0.13, transition:"opacity 0.4s ease" }}>
                <div style={{ position:"absolute", bottom:0, right:0, width:"100%", height:1.5, background:m.color }} />
                <div style={{ position:"absolute", bottom:0, right:0, width:1.5, height:"100%", background:m.color }} />
              </div>

              {/* ── Elementos atmosféricos ── */}
              {/* Pilar de luz vertical */}
              <div style={{ position:"absolute", bottom:"clamp(180px,26.2vh,235px)", left:"50%", transform:"translateX(-50%)", width:"45%", height:"72%", background:`radial-gradient(ellipse at 50% 100%, ${m.color}${isActive?"1a":"06"} 0%, transparent 70%)`, transition:"background 0.55s ease", pointerEvents:"none" }} />

              {/* Halo circular com animação de respiração */}
              <div style={{ position:"absolute", bottom:"clamp(185px,27vh,240px)", left:"50%", transform:"translateX(-50%)", width:"clamp(175px,24vw,305px)", height:"clamp(175px,24vw,305px)", borderRadius:"50%", background:`radial-gradient(circle, ${m.color}28 0%, ${m.color}0b 45%, transparent 70%)`, opacity:isActive?1:0, willChange:"opacity", animation:isActive?"msHaloBreathe 2.6s ease-in-out infinite":"none", pointerEvents:"none" }} />

              {/* Chão iluminado (reflexo de palco) */}
              <div style={{ position:"absolute", bottom:"clamp(180px,26.2vh,235px)", left:0, right:0, height:"clamp(26px,4.5vh,42px)", background:`linear-gradient(to top, ${m.color}${isActive?"18":"06"} 0%, transparent 100%)`, transition:"background 0.5s ease", pointerEvents:"none" }} />

              {/* Brilho pontual nos pés */}
              <div style={{ position:"absolute", bottom:"clamp(180px,26.2vh,235px)", left:"50%", transform:"translateX(-50%)", width:"80px", height:"14px", background:`radial-gradient(ellipse, ${m.color}${isActive?"52":"16"} 0%, transparent 70%)`, filter:"blur(8px)", transition:"background 0.45s ease", pointerEvents:"none" }} />

              {/* ── Arte do personagem (GPU-only) ── */}
              <div style={{ position:"absolute", bottom:"clamp(185px,27vh,240px)", left:"50%", transform:`translateX(-50%) translateY(${isActive?"-10px":"0px"}) scale(${isActive?(isCenter?1.055:1.045):(isCenter?1.015:1)})`, height:isCenter?"clamp(305px,65vh,565px)":"clamp(275px,61vh,530px)", transformOrigin:"bottom center", willChange:"transform", transition:"transform 0.52s cubic-bezier(0.25, 0.46, 0.45, 0.94)", pointerEvents:"none" }}>
                <img src={m.art} alt={m.name} style={{ height:"100%", objectFit:"contain", objectPosition:"bottom center", filter:isActive?`drop-shadow(0 0 24px ${m.color}70) drop-shadow(0 0 48px ${m.color}1e)`:"drop-shadow(0 10px 22px rgba(0,0,0,0.8))", transition:"filter 0.52s ease" }} />
              </div>

              {/* ── Área de info (altura fixa → zero layout shift) ── */}
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"clamp(182px,26.5vh,237px)", background:"linear-gradient(to top, rgba(5,5,8,0.99) 0%, rgba(5,5,8,0.90) 55%, transparent 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", padding:`0 clamp(10px,1.8vw,18px) clamp(12px,2.2vh,20px)` }}>

                {/* Badge elemento com pontos laterais */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                  <div style={{ width:4, height:4, borderRadius:"50%", background:m.color, opacity:isActive?0.9:0.32, transition:"opacity 0.4s ease", boxShadow:isActive?`0 0 6px ${m.color}`:"none" }} />
                  <div style={{ fontSize:"clamp(7px,0.76vw,9px)", fontWeight:800, letterSpacing:"0.22em", textTransform:"uppercase", color:m.color, background:isActive?`${m.color}18`:`${m.color}0b`, border:`1px solid ${m.color}${isActive?"50":"1e"}`, padding:"3px 12px", borderRadius:20, boxShadow:isActive?`0 0 10px ${m.color}30`:"none", transition:"background 0.4s ease, border 0.4s ease, box-shadow 0.4s ease" }}>
                    {m.element}
                  </div>
                  <div style={{ width:4, height:4, borderRadius:"50%", background:m.color, opacity:isActive?0.9:0.32, transition:"opacity 0.4s ease", boxShadow:isActive?`0 0 6px ${m.color}`:"none" }} />
                </div>

                {/* Nome dividido: PRIMEIRO (grande) + SOBRENOME (pequeno, espaçado) */}
                <div style={{ textAlign:"center", marginBottom:6 }}>
                  <div style={{ fontSize:isCenter?"clamp(19px,2.1vw,28px)":"clamp(17px,1.88vw,25px)", fontWeight:900, color:"#fff", lineHeight:1.05, letterSpacing:"0.06em", textTransform:"uppercase", textShadow:isActive?`0 0 22px ${m.shadowGlow}, 0 2px 4px rgba(0,0,0,0.9)`:"0 2px 8px rgba(0,0,0,0.9)", transition:"text-shadow 0.5s ease" }}>
                    {givenName}
                  </div>
                  {familyName && (
                    <div style={{ fontSize:isCenter?"clamp(9px,1.0vw,13px)":"clamp(8px,0.9vw,12px)", fontWeight:400, color:`rgba(255,255,255,${isActive?"0.55":"0.26"})`, letterSpacing:"0.28em", textTransform:"uppercase", lineHeight:1.3, transition:"color 0.5s ease" }}>
                      {familyName}
                    </div>
                  )}
                </div>

                {/* Deck com linhas flanqueando */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7, width:"clamp(70px,60%,140px)" }}>
                  <div style={{ flex:1, height:1, background:`${m.color}${isActive?"45":"1a"}`, transition:"background 0.4s ease" }} />
                  <span style={{ fontSize:"clamp(8px,0.82vw,10px)", color:`${m.color}${isActive?"cc":"52"}`, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap", transition:"color 0.4s ease" }}>{m.deckName}</span>
                  <div style={{ flex:1, height:1, background:`${m.color}${isActive?"45":"1a"}`, transition:"background 0.4s ease" }} />
                </div>

                {/* Descrição: fade+slide, container de altura fixa */}
                <div style={{ height:"clamp(34px,5vh,48px)", display:"flex", alignItems:"flex-start", justifyContent:"center", overflow:"hidden", marginBottom:9, width:"100%" }}>
                  <p style={{ fontSize:"clamp(9px,0.84vw,10.5px)", color:"rgba(255,255,255,0.42)", textAlign:"center", lineHeight:1.55, margin:0, maxWidth:215, opacity:isActive?1:0, transform:isActive?"translateY(0)":"translateY(5px)", transition:"opacity 0.42s ease, transform 0.42s ease" }}>
                    {m.deckDesc}
                  </p>
                </div>

                {/* Botão DECK INICIAL */}
                <button onClick={e => { e.stopPropagation(); setViewingDeck(id) }} style={{ width:"clamp(88px,74%,162px)", marginBottom:5, padding:"clamp(5px,0.82vh,7px) 0", background:"transparent", border:`1px solid ${m.color}${isActive?"42":"16"}`, borderRadius:7, color:`${m.color}${isActive?"ee":"65"}`, fontSize:"clamp(8px,0.84vw,10px)", fontWeight:700, textAlign:"center", letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Segoe UI',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:4, transition:"background 0.3s ease, border-color 0.3s ease, color 0.3s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background=`${m.color}15`; e.currentTarget.style.borderColor=`${m.color}75`; e.currentTarget.style.color=m.color }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=`${m.color}${isActive?"42":"16"}`; e.currentTarget.style.color=`${m.color}${isActive?"ee":"65"}` }}
                >
                  <span style={{ fontSize:10 }}>🃏</span> Deck Inicial
                </button>

                {/* Botão ESCOLHER */}
                <div style={{ width:"clamp(88px,74%,162px)", padding:"clamp(6px,0.95vh,9px) 0", background:isSel?`linear-gradient(135deg, ${m.color}cc, ${m.color})`:isActive?`${m.color}20`:"rgba(255,255,255,0.04)", border:`1px solid ${isSel?m.color:isActive?m.color+"52":"rgba(255,255,255,0.07)"}`, borderRadius:8, color:isSel?"#fff":isActive?m.color:"rgba(255,255,255,0.24)", fontSize:"clamp(8px,0.88vw,10px)", fontWeight:800, textAlign:"center", letterSpacing:"0.13em", textTransform:"uppercase", boxShadow:isSel?`0 3px 16px ${m.color}50, inset 0 0 0 1px ${m.color}42`:"none", transition:"background 0.4s ease, border 0.4s ease, color 0.4s ease, box-shadow 0.4s ease" }}>
                  {isSel ? "✓ Selecionado" : "Escolher"}
                </div>
              </div>

              {/* Borda de seleção */}
              {isSel && <div style={{ position:"absolute", inset:0, border:`1px solid ${m.color}2e`, animation:"tutFadeIn 0.3s ease both", pointerEvents:"none" }} />}

              {/* Cortina de entrada escalonada */}
              <div style={{ position:"absolute", inset:0, background:"#050508", opacity:entered?0:1, transition:`opacity 0.7s ease ${idx*0.2}s`, pointerEvents:"none" }} />
            </div>
          )
        })}
      </div>

      {/* Rodapé */}
      <div style={{ position:"absolute", bottom:8, left:0, right:0, textAlign:"center", zIndex:30, pointerEvents:"none", animation:"tutFadeIn 1s ease 0.9s both" }}>
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.13)", letterSpacing:"0.18em", textTransform:"uppercase" }}>Passe o mouse para ver mais detalhes</span>
      </div>

      {/* Modal de preview do Deck */}
      {viewingDeck && <StarterDeckModal masterId={viewingDeck} onClose={() => setViewingDeck(null)} />}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TUTORIAL DUEL SIM — duelo 100% roteirizado e determinístico, NÃO é a
// DuelScreen real. Construído à parte porque o roteiro exige comportamento
// exato do "bot" (LP fixo em 5, ele baixa 2 Traps sem ativar, etc.) que um
// bot de verdade nunca reproduziria de forma confiável. Visualmente segue o
// mesmo estilo da tela de duelo real, mas cada passo é 100% controlado aqui.
// ═══════════════════════════════════════════════════════════════════════════════

type DuelSimStepId =
  | "deck-select" | "intro-lp" | "intro-hand" | "intro-tap"
  | "explain-unit" | "explain-troops" | "explain-action" | "explain-trap"
  | "explain-scenario" | "explain-ultimate"
  | "play-unit" | "end-turn" | "opponent-turn"
  | "tap-pickup" | "equip-ultimate" | "attack-win" | "victory"

interface DuelSimStep {
  id: DuelSimStepId
  text: string
  /** qual elemento da mesa fica em destaque (estilizado localmente, sem
   *  precisar de getBoundingClientRect já que é tudo JSX nosso) */
  highlight: "hand-unit" | "hand-troops" | "hand-action" | "hand-trap" | "hand-scenario"
           | "tap-card" | "field-unit" | "end-turn-btn" | "attack-btn" | "menu-btn" | null
  /** precisa de clique no alvo destacado pra avançar (senão é só o balão) */
  requiresTargetClick?: boolean
  /** passo "fantasma" sem balão nem escurecimento — usado no turno do bot */
  noBubble?: boolean
  autoAdvanceMs?: number
}

function buildDuelScript(masterId: TutorialMasterId): DuelSimStep[] {
  const m = MASTERS[masterId]
  const unitName = `${m.name.split(" ")[0]} 3DP`
  const deck = STARTER_DECKS[masterId]
  const ultName = deck.tap[0].card.name

  return [
    { id: "deck-select", highlight: null,
      text: "Primeiro, selecione o seu Deck Inicial para entrar em batalha!" },
    { id: "intro-lp", highlight: null,
      text: "Bem-vindo à mesa de duelo! Você e seu oponente começam com 5 LP — Pontos de Vida. Quem chegar a zero primeiro, perde!" },
    { id: "intro-hand", highlight: null,
      text: "Estas são as cartas da sua mão. Vou te explicar rapidinho cada tipo delas." },
    { id: "intro-tap", highlight: null,
      text: "E ali está o TAP! Guarda esse nome — daqui a pouco eu te explico melhor como ele funciona." },
    { id: "explain-unit", highlight: "hand-unit",
      text: "Esta é uma carta de Unidade — seus personagens principais, como eu! Quanto maior o DP, mais forte ela é." },
    { id: "explain-troops", highlight: "hand-troops",
      text: "Esta é uma Unidade de Tropas — aliados menores, mas que também lutam ao seu lado com habilidades próprias." },
    { id: "explain-action", highlight: "hand-action",
      text: "Cartas de Action Funcion têm efeitos poderosos assim que são ativadas." },
    { id: "explain-trap", highlight: "hand-trap",
      text: "As Trap Funcions ficam viradas pra baixo no campo, prontas pra surpreender o oponente quando ele menos esperar." },
    { id: "explain-scenario", highlight: "hand-scenario",
      text: "E as cartas de Scenario mudam as regras do campo de batalha inteiro enquanto estão ativas!" },
    { id: "explain-ultimate", highlight: "tap-card",
      text: `E por último, os Ultimates — equipamentos lendários, como a minha! Olha ali no TAP: ${ultName}. Você vai pegar um desses já já.` },
    { id: "play-unit", highlight: "hand-unit", requiresTargetClick: true,
      text: `Agora é sua vez! Jogue ${unitName} no campo — clique na carta dele(a) na sua mão!` },
    { id: "end-turn", highlight: "end-turn-btn", requiresTargetClick: true,
      text: "Muito bem! Agora passe o turno para o oponente." },
    { id: "opponent-turn", highlight: null, noBubble: true, autoAdvanceMs: 2600,
      text: "" },
    { id: "tap-pickup", highlight: "tap-card", requiresTargetClick: true,
      text: `Chegou o TAP! A cada 3 turnos uma carta surge aqui de graça. Pegue ${ultName} — ela está brilhando!` },
    { id: "equip-ultimate", highlight: "field-unit", requiresTargetClick: true,
      text: `Perfeito! Agora equipe essa Ultimate Gear em ${unitName} para deixá-lo(a) ainda mais forte!` },
    { id: "attack-win", highlight: "attack-btn", requiresTargetClick: true,
      text: "Hora de atacar! Vá direto no seu oponente e vença este duelo!" },
    { id: "victory", highlight: "menu-btn", requiresTargetClick: true,
      text: "VOCÊ VENCEU! Muito bem mesmo! Agora clique em Voltar ao Main Menu." },
  ]
}

/** Busca a primeira carta de um certo `type` no Deck Principal do Mestre */
function findCardByType(masterId: TutorialMasterId, type: string): GameCard {
  const deck = STARTER_DECKS[masterId]
  const entry = deck.main.find(e => e.card.type === type)
  return entry ? entry.card : deck.main[0].card
}

/** Mão inicial fixa do duelo-tutorial: 1 de cada tipo relevante */
function buildTutorialHand(masterId: TutorialMasterId): Record<string, GameCard> {
  const deck = STARTER_DECKS[masterId]
  const masterUnitUR = deck.main.find(e => e.card.type === "unit" && e.card.rarity === "UR")?.card
    ?? deck.main[1].card
  return {
    unit: masterUnitUR,
    troops: findCardByType(masterId, "troops"),
    action: findCardByType(masterId, "action"),
    trap: findCardByType(masterId, "trap"),
    scenario: findCardByType(masterId, "scenario"),
  }
}

function TutorialDuelSim({ masterId, onFinish }: {
  masterId: TutorialMasterId
  onFinish: () => void
}) {
  const m = MASTERS[masterId]
  const deck = STARTER_DECKS[masterId]
  const ultimateCard = deck.tap[0].card
  const hand = useMemo(() => buildTutorialHand(masterId), [masterId])
  const script = useMemo(() => buildDuelScript(masterId), [masterId])

  const [stepIdx, setStepIdx] = useState(0)
  const step = script[stepIdx]

  // ── Estado da mesa (tudo fake/controlado por nós) ──────────────────────────
  const [deckPicked, setDeckPicked] = useState(false)
  const [unitInHand, setUnitInHand] = useState(true)
  const [unitInField, setUnitInField] = useState(false)
  const [equipped, setEquipped] = useState(false)
  const [turn, setTurn] = useState(1)
  const [opponentTrapsVisible, setOpponentTrapsVisible] = useState(0) // 0,1,2
  const [tapCardTaken, setTapCardTaken] = useState(false)
  const [attacking, setAttacking] = useState(false)
  const [opponentLP, setOpponentLP] = useState(5)
  const [entered, setEntered] = useState(false)

  useEffect(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t) }, [])

  const advance = useCallback(() => setStepIdx(i => Math.min(i + 1, script.length - 1)), [script.length])

  // ── Passo "fantasma" do turno do oponente: anima 2 traps e auto-avança ────
  useEffect(() => {
    if (step.id !== "opponent-turn") return
    setTurn(2)
    const t1 = setTimeout(() => setOpponentTrapsVisible(1), 500)
    const t2 = setTimeout(() => setOpponentTrapsVisible(2), 1000)
    const t3 = setTimeout(() => { setTurn(3); advance() }, step.autoAdvanceMs ?? 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [step.id, step.autoAdvanceMs, advance])

  // ── Ações disparadas pelos cliques nos alvos destacados ────────────────────
  const handleDeckClick = () => { setDeckPicked(true); setTimeout(advance, 350) }
  const handlePlayUnit = () => { setUnitInHand(false); setUnitInField(true); setTimeout(advance, 280) }
  const handleEndTurn = () => advance()
  const handleTapPickup = () => { setTapCardTaken(true); setTimeout(advance, 350) }
  const handleEquip = () => { setEquipped(true); setTimeout(advance, 350) }
  const handleAttack = () => {
    setAttacking(true)
    setTimeout(() => setOpponentLP(0), 550)
    setTimeout(advance, 1400)
  }
  const handleBackToMenu = () => onFinish()

  // ── Clique genérico no elemento destacado, despachado pro handler certo ───
  const onTargetClick = () => {
    switch (step.id) {
      case "play-unit": handlePlayUnit(); break
      case "end-turn": handleEndTurn(); break
      case "tap-pickup": handleTapPickup(); break
      case "equip-ultimate": handleEquip(); break
      case "attack-win": handleAttack(); break
      case "victory": handleBackToMenu(); break
    }
  }

  const isHighlighted = (key: NonNullable<DuelSimStep["highlight"]>) => step.highlight === key

  // ── Estilo de destaque reutilizável ────────────────────────────────────────
  const glow = (active: boolean, color: string) => active ? {
    boxShadow: `0 0 0 3px ${color}, 0 0 22px ${color}99`,
    transform: "scale(1.08) translateY(-4px)",
    zIndex: 10,
    cursor: "pointer",
    animation: "tutRingPulse 1.4s ease-in-out infinite",
  } : { opacity: (step.highlight && !active) ? 0.35 : 1, filter: (step.highlight && !active) ? "saturate(0.4)" : "none" }

  // ═══════════════════════════════════════════════════════════════════════
  // SUB-TELA: SELEÇÃO DE DECK (antes de entrar na mesa)
  // ═══════════════════════════════════════════════════════════════════════
  if (!deckPicked) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 700, background: "#04060d",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif",
        opacity: entered ? 1 : 0, transition: "opacity 0.4s ease",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${m.bgGlow} 0%, transparent 65%)`,
          pointerEvents: "none",
        }} />
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 10, zIndex: 1 }}>
          Escolha seu Deck
        </span>
        {/* O clique no card é o ÚNICO jeito de avançar */}
        <button
          onClick={handleDeckClick}
          style={{
            zIndex: 1, width: "clamp(220px, 30vw, 320px)", padding: "22px 24px",
            background: `linear-gradient(135deg, ${m.bgGlow} 0%, rgba(10,10,18,0.95) 100%)`,
            border: `2px solid ${m.color}`, borderRadius: 16, cursor: "pointer",
            boxShadow: `0 0 30px ${m.bgGlow}, 0 0 0 4px ${m.color}30`,
            animation: "tutRingPulse 1.5s ease-in-out infinite",
            display: "flex", alignItems: "center", gap: 14, textAlign: "left",
          }}
        >
          <span style={{ fontSize: 28 }}>🃏</span>
          <div>
            <div style={{ color: m.color, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 3 }}>DECK ATIVO</div>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>Deck Inicial</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>20 cartas</div>
          </div>
        </button>
        {/* Balão: botão é visual-only, clique obrigatório no deck acima */}
        <MasterBubble
          masterId={masterId}
          text="Selecione o Deck Inicial para entrar em batalha!"
          onNext={() => {/* no-op: clique no deck acima é obrigatório */}}
          nextLabel="👆 Clique no Deck acima"
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MESA DE DUELO
  // ═══════════════════════════════════════════════════════════════════════
  const handCardDefs: { key: "unit" | "troops" | "action" | "trap" | "scenario"; highlightKey: DuelSimStep["highlight"] }[] = [
    { key: "unit", highlightKey: "hand-unit" },
    { key: "troops", highlightKey: "hand-troops" },
    { key: "action", highlightKey: "hand-action" },
    { key: "trap", highlightKey: "hand-trap" },
    { key: "scenario", highlightKey: "hand-scenario" },
  ]
  const visibleHandCards = handCardDefs.filter(c => !(c.key === "unit" && !unitInHand))

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 700,
      background: "linear-gradient(180deg, #02050d 0%, #050b18 100%)",
      fontFamily: "'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      opacity: entered ? 1 : 0, transition: "opacity 0.4s ease",
    }}>
      <style>{`
        @keyframes tutAttackDash {
          0%   { transform: translateX(0); }
          40%  { transform: translateX(120px); }
          55%  { transform: translateX(120px); }
          100% { transform: translateX(0); }
        }
        @keyframes tutTrapDrop {
          from { opacity: 0; transform: translateY(-14px) scale(0.8); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tutCardToField {
          from { opacity: 0.4; transform: scale(0.7) translateY(40px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Estrelas de fundo */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.55) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 82% 14%, rgba(255,255,255,0.45) 0%, transparent 100%)," +
          "radial-gradient(1.5px 1.5px at 55% 68%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 91% 78%, rgba(255,255,255,0.38) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 30% 42%, rgba(255,255,255,0.32) 0%, transparent 100%)",
      }} />

      {/* ── Barra superior ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", flexShrink: 0, gap: 10, zIndex: 2 }}>
        <div style={{
          background: "rgba(220,38,38,0.22)", border: "2px solid #ef4444", borderRadius: 12,
          padding: "8px 18px", color: "white", fontWeight: 800, fontSize: "clamp(13px, 1.7vw, 18px)",
          transition: "all 0.3s ease",
        }}>
          Oponente — <span style={{ color: opponentLP <= 0 ? "#86efac" : "#fca5a5" }}>LP: {opponentLP}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 14px", color: "#fbbf24", fontWeight: 800, fontSize: "clamp(12px, 1.5vw, 16px)" }}>
            TURNO {turn}
          </div>
          <div style={{
            background: turn === 2 ? "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)" : "linear-gradient(135deg, #14532d 0%, #15803d 100%)",
            border: `1px solid ${turn === 2 ? "#ef4444" : "#22c55e"}`, borderRadius: 10,
            padding: "8px 16px", color: "white", fontWeight: 800, fontSize: "clamp(11px, 1.4vw, 15px)", letterSpacing: "0.05em",
            transition: "all 0.3s ease",
          }}>
            {turn === 2 ? "TURNO DO OPONENTE" : "SEU TURNO"}
          </div>
        </div>
      </div>

      {/* ── Campo ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "0 10px", zIndex: 2, position: "relative" }}>
        {/* Zona oponente */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: "clamp(58px, 7.5vw, 86px)", aspectRatio: "0.7", borderRadius: 10,
              background: opponentTrapsVisible > i ? "linear-gradient(160deg, #7c2d1226 0%, rgba(0,0,0,0.88) 100%)" : "rgba(255,255,255,0.02)",
              border: opponentTrapsVisible > i ? "1px solid #f9731650" : "1px dashed rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: opponentTrapsVisible > i ? "tutTrapDrop 0.4s ease both" : "none",
              fontSize: 22, color: "#f97316",
            }}>
              {opponentTrapsVisible > i ? "🂠" : ""}
            </div>
          ))}
          {opponentLP <= 0 && attacking === false && (
            <div style={{
              position: "absolute", color: "#86efac", fontWeight: 900, fontSize: "clamp(20px,3vw,32px)",
              textShadow: "0 0 24px rgba(134,239,172,0.8)", animation: "tutFadeIn 0.4s ease both",
            }}>
              ✦ VITÓRIA! ✦
            </div>
          )}
        </div>

        {/* Divisor */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", flexShrink: 0 }} />

        {/* Zona jogador */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {/* TAP — 2 slots */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>TAP</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[ultimateCard, null].map((card, i) => {
                const isThisHighlighted = i === 0 && isHighlighted("tap-card") && !tapCardTaken
                const taken = i === 0 && tapCardTaken
                return (
                  <div key={i}
                    onClick={isThisHighlighted ? onTargetClick : undefined}
                    style={{
                      width: "clamp(48px, 6vw, 68px)", aspectRatio: "0.72", borderRadius: 8,
                      background: taken ? "rgba(255,255,255,0.02)" : i === 0
                        ? `linear-gradient(160deg, ${m.color}30 0%, rgba(0,0,0,0.85) 100%)`
                        : "rgba(255,255,255,0.04)",
                      border: i === 0 ? `1px solid ${m.color}60` : "1px dashed rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                      position: "relative", transition: "all 0.3s ease",
                      opacity: taken ? 0.15 : 1,
                      ...(isThisHighlighted ? glow(true, m.color) : {}),
                    }}
                  >
                    {i === 0 && !taken && (
                      <img src={card!.image} alt={card!.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Carta de unidade em campo */}
          <div
            onClick={isHighlighted("field-unit") ? onTargetClick : undefined}
            style={{
              width: "clamp(64px, 8vw, 96px)", aspectRatio: "0.7", borderRadius: 10,
              background: unitInField ? `linear-gradient(160deg, ${m.color}30 0%, rgba(0,0,0,0.88) 100%)` : "rgba(255,255,255,0.02)",
              border: unitInField ? `1.5px solid ${m.color}70` : "1px dashed rgba(255,255,255,0.08)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
              overflow: "hidden", position: "relative", transition: "all 0.3s ease",
              animation: unitInField ? "tutCardToField 0.4s ease both" : "none",
              ...(isHighlighted("field-unit") ? glow(true, m.color) : {}),
            }}
          >
            {unitInField && (
              <>
                <img src={hand.unit.image} alt={hand.unit.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                {equipped && (
                  <div style={{
                    position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.7)",
                    border: `1px solid ${m.color}`, borderRadius: 5, padding: "1px 4px",
                    fontSize: 8, color: m.color, fontWeight: 800, zIndex: 2,
                  }}>
                    ⚔️
                  </div>
                )}
                {attacking && (
                  <div style={{ position: "absolute", inset: 0, animation: "tutAttackDash 0.6s ease both", background: "transparent" }} />
                )}
              </>
            )}
          </div>

          {/* Botão de batalha */}
          <button
            onClick={isHighlighted("attack-btn") ? onTargetClick : undefined}
            disabled={!isHighlighted("attack-btn")}
            style={{
              background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
              border: "1px solid #22c55e", borderRadius: 12, padding: "12px 18px",
              color: "white", fontWeight: 800, fontSize: 12, letterSpacing: "0.04em",
              fontFamily: "'Segoe UI', sans-serif",
              ...(isHighlighted("attack-btn") ? glow(true, "#22c55e") : { opacity: step.highlight ? 0.3 : 0.55, cursor: "default" }),
            }}
          >
            ⚔️ Ir para Batalha
          </button>
        </div>
      </div>

      {/* ── Mão do jogador ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.65)", padding: "8px 10px 12px", flexShrink: 0, zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button
            onClick={isHighlighted("end-turn-btn") ? onTargetClick : undefined}
            disabled={!isHighlighted("end-turn-btn")}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 9, padding: "6px 16px", color: "#fff", fontWeight: 700, fontSize: 11,
              fontFamily: "'Segoe UI', sans-serif",
              ...(isHighlighted("end-turn-btn") ? glow(true, "#60a5fa") : { opacity: step.highlight ? 0.3 : 0.6, cursor: "default" }),
            }}
          >
            Passar Turno ►
          </button>
          <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 20, padding: "5px 16px", color: "white", fontWeight: 800, fontSize: "clamp(11px, 1.35vw, 15px)" }}>
            Você — <span style={{ color: "#93c5fd" }}>LP: 5</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "clamp(5px, 1vw, 10px)", justifyContent: "center" }}>
          {visibleHandCards.map(({ key, highlightKey }) => {
            const card = hand[key]
            const active = isHighlighted(highlightKey)
            const clickable = active && step.requiresTargetClick && key === "unit"
            return (
              <div key={key}
                onClick={clickable ? onTargetClick : undefined}
                style={{
                  width: "clamp(50px, 6.6vw, 80px)", aspectRatio: "0.7", borderRadius: 9,
                  overflow: "hidden", position: "relative",
                  border: `1px solid ${RARITY_COLORS[card.rarity] ?? "#94a3b8"}55`,
                  transition: "all 0.3s ease",
                  ...glow(active, RARITY_COLORS[card.rarity] ?? m.color),
                }}
              >
                <img src={card.image} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Botão "Voltar ao Main Menu" — só aparece/clicável no passo de vitória */}
      {step.id === "victory" && (
        <button
          onClick={onTargetClick}
          style={{
            position: "fixed", bottom: "clamp(120px, 18vh, 165px)", left: "50%", transform: "translateX(-50%)",
            background: `linear-gradient(135deg, ${m.color}cc, ${m.color})`, border: "none", borderRadius: 12,
            padding: "12px 28px", color: "white", fontWeight: 800, fontSize: 13,
            letterSpacing: "0.05em", cursor: "pointer", zIndex: 5,
            boxShadow: `0 4px 22px ${m.shadowGlow}`,
            fontFamily: "'Segoe UI', sans-serif",
            animation: "tutRingPulse 1.4s ease-in-out infinite",
          }}
        >
          🏠 Voltar ao Main Menu
        </button>
      )}

      {/* Balão do Mestre — escondido durante o turno do oponente */}
      {!step.noBubble && (
        <MasterBubble
          masterId={masterId}
          text={step.text}
          onNext={step.requiresTargetClick ? onTargetClick : advance}
          nextLabel={step.requiresTargetClick ? "👆 Faça isso na mesa" : "Entendido ►"}
        />
      )}
    </div>
  )
}


export function TutorialGameOverlay({ masterId, onNavigate, onComplete }: TutorialGameOverlayProps) {
  const [phase, setPhase] = useState<OverlayPhase>("menu")
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => { setTimeout(() => setVisible(true), 80) }, [])

  // ── Helpers de fase (calculados sempre, antes de qualquer return) ───────────
  // Quando phase === "duel-sim" não há "currentStep" — usamos null seguro
  const currentSteps =
    phase === "menu"            ? MENU_STEPS       :
    phase === "post-duel-menu"  ? POST_DUEL_STEPS  :
    phase === "gacha"           ? GACHA_STEPS      :
    MENU_STEPS  // duel-sim: valor dummy, nunca usado abaixo

  const currentStep     = phase === "duel-sim" ? null : currentSteps[step]
  const isLastStep      = phase === "duel-sim" ? false : step === currentSteps.length - 1
  const isInterceptStep = !!(currentStep as any)?.interceptClick
  const isHidden        = !!(currentStep as any)?.hidden

  // ── Auto-avança em passos "fantasma" (TODOS os hooks antes de qualquer return)
  useEffect(() => {
    // Não faz nada durante o duelo ou se não há autoAdvance
    if (phase === "duel-sim") return
    const ms = (currentStep as any)?.autoAdvanceMs
    if (!ms) return
    const t = setTimeout(() => {
      if (isLastStep) onComplete()
      else setStep(s => s + 1)
    }, ms)
    return () => clearTimeout(t)
  }, [step, phase, currentStep, isLastStep, onComplete])

  // ── Handlers (definidos antes de qualquer return) ───────────────────────────
  const handleInterceptClick = () => {
    if (phase === "menu") {
      setPhase("duel-sim")
    } else if (phase === "post-duel-menu") {
      onNavigate("gacha")
      setPhase("gacha")
      setStep(0)
    }
  }

  const handleBubbleNext = () => {
    if (isInterceptStep) return   // botão do balão é no-op nos passos forçados
    if (isLastStep) onComplete()
    else setStep(s => s + 1)
  }

  const totalDots = MENU_STEPS.length + POST_DUEL_STEPS.length + GACHA_STEPS.length
  const globalDot =
    phase === "menu"            ? step :
    phase === "post-duel-menu"  ? MENU_STEPS.length + step :
    MENU_STEPS.length + POST_DUEL_STEPS.length + step

  // ── Fase duel-sim: renderiza o simulador em tela cheia ──────────────────────
  // IMPORTANTE: este return só acontece DEPOIS de todos os hooks acima.
  // Colocar um return antes de um hook viola as Regras dos Hooks do React
  // e causa crash de runtime ("Rendered more hooks than during previous render").
  if (phase === "duel-sim") {
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        <TutorialDuelSim
          masterId={masterId}
          onFinish={() => {
            onNavigate("menu")
            setPhase("post-duel-menu")
            setStep(0)
          }}
        />
      </>
    )
  }

  // ── Fases menu / post-duel-menu / gacha ─────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      opacity: visible ? 1 : 0, transition: "opacity 0.5s ease",
      pointerEvents: "none",
    }}>
      <style>{TUTORIAL_CSS}</style>

      {/* Spotlight dinâmico — passa o interceptor nos passos obrigatórios */}
      {!isHidden && (
        <DynamicSpotlight
          textTarget={currentStep?.textTarget ?? null}
          onInterceptClick={isInterceptStep ? handleInterceptClick : undefined}
        />
      )}

      {/* Pontinhos de progresso */}
      <div style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 5, zIndex: 500, pointerEvents: "none",
      }}>
        {Array.from({ length: totalDots }).map((_, i) => (
          <div key={i} style={{
            width: i === globalDot ? 16 : 5, height: 5, borderRadius: 3,
            background: i <= globalDot ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Balão do Mestre — oculto em passos fantasma */}
      {!isHidden && (
        <div style={{ pointerEvents: "all" }}>
          <MasterBubble
            masterId={masterId}
            text={currentStep?.text ?? ""}
            onNext={handleBubbleNext}
            nextLabel={
              isInterceptStep
                ? phase === "menu"
                  ? "👆 Clique no botão JOGAR acima"
                  : "👆 Clique no botão GACHA acima"
                : isLastStep
                ? "Finalizar Tutorial ►"
                : "Entendido ►"
            }
          />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS GLOBAL DO TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

const TUTORIAL_CSS = `
  /* ── Master Select ───────────────────── */
  @keyframes msConfirmBg {
    0%   { opacity: 0; transform: scale(1.15); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes msConfirmArt {
    0%   { opacity: 0; transform: translateY(30px) scale(0.82); }
    60%  { opacity: 1; transform: translateY(-6px) scale(1.03); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes msRays {
    0%   { opacity: 0; transform: translateX(-50%) rotate(-8deg); }
    100% { opacity: 1; transform: translateX(-50%) rotate(0deg); }
  }
  @keyframes msDeckModalIn {
    0%   { opacity: 0; transform: translateY(18px) scale(0.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes msHaloBreathe {
    0%, 100% { opacity: 0.72; transform: translateX(-50%) scale(1); }
    50%       { opacity: 1;    transform: translateX(-50%) scale(1.06); }
  }
  /* ── Shared ──────────────────────────── */
  @keyframes tutFadeIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes tutSlideLeft {
    from { opacity:0; transform:translateX(-44px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes tutSlideRight {
    from { opacity:0; transform:translateX(44px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes tutMasterIn {
    from { opacity:0; transform:scale(0.78) translateY(22px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes tutRingPulse {
    0%,100% { opacity:0.5; }
    50%     { opacity:1; }
  }
  @keyframes tutCursor {
    0%,100% { opacity:1; }
    50%     { opacity:0; }
  }
`

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT: TUTORIAL SCREEN (standalone — lore + seleção de mestre)
// ═══════════════════════════════════════════════════════════════════════════════

export default function TutorialScreen({ playerName, onComplete }: TutorialScreenProps) {
  const [phase, setPhase] = useState<"lore" | "master-select">("lore")
  const [loreStep, setLoreStep] = useState(0)
  const [selectedMaster, setSelectedMaster] = useState<TutorialMasterId | null>(null)
  const [masterConfirmed, setMasterConfirmed] = useState(false)
  const [visible, setVisible] = useState(false)

  const loreSlides = buildLoreSlides(playerName)
  useEffect(() => { setTimeout(() => setVisible(true), 80) }, [])

  const advanceLore = useCallback(() => {
    if (loreStep < loreSlides.length - 1) setLoreStep(s => s + 1)
    else setPhase("master-select")
  }, [loreStep, loreSlides.length])

  const skipLore = useCallback(() => setPhase("master-select"), [])

  const handleMasterSelect = useCallback((id: TutorialMasterId) => {
    setSelectedMaster(id)
    setMasterConfirmed(true)
    // Aguarda animação de confirmação e chama onComplete
    // (game-wrapper cuida da navegação para o main-menu real)
    setTimeout(() => onComplete(id), 2700)
  }, [onComplete])

  return (
    <div style={{
      position: "fixed", inset: 0,
      opacity: visible ? 1 : 0, transition: "opacity 0.7s ease",
      zIndex: 9990,
    }}>
      <style>{TUTORIAL_CSS}</style>

      {phase === "lore" && (
        <LorePhase
          slides={loreSlides}
          currentSlide={loreStep}
          onAdvance={advanceLore}
          onSkip={skipLore}
        />
      )}

      {phase === "master-select" && (
        <MasterSelectPhase
          playerName={playerName}
          onSelect={handleMasterSelect}
          selectedMaster={selectedMaster}
          confirmed={masterConfirmed}
        />
      )}
    </div>
  )
}
