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

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  /** game-wrapper navega para a tela certa quando solicitado pelo overlay */
  onNavigate: (screen: "menu" | "gacha" | "duel") => void
  /** Chamado quando TODO o tutorial (overlay) é concluído */
  onComplete: () => void
  /**
   * Sinalizado como true pelo game-wrapper quando o duelo real do tutorial
   * terminou (jogador clicou em Voltar no DuelScreen). Quando true enquanto
   * phase === "duel-sim", o overlay avança para post-duel-menu.
   */
  postDuelReady?: boolean
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

// ── Guia do DUELO REAL (por cima do DuelScreen verdadeiro) ──────────────────────
// kind "click": clique obrigatório de verdade — bloqueia a tela inteira
//   (DynamicSpotlight), abre buraco só no elemento certo, intercepta o clique
//   e replica no elemento real por baixo (handleDuelInterceptClick), avança
//   sozinho, sem botão no balão.
// kind "highlight": só leitura, mas com um buraco VISUAL (sem intercept) no
//   elemento real sendo explicado — a área fica com opacidade normal em vez
//   de escurecida. Avança com um botão real "Entendido ►" no balão.
// kind "info": só leitura, sem nenhum buraco (tela inteira escurecida).
//   Avança com um botão real "Entendido ►" no balão.
const DUEL_STEPS: { text: string; textTarget: string | null; kind: "click" | "highlight" | "info" }[] = [
  // ── Setup (clicks obrigatórios nos elementos reais do DuelScreen) ────────────
  { text: "Selecione o Deck Inicial para entrar em batalha! Clique no deck em destaque.",
    textTarget: "Deck Inicial", kind: "click" },
  { text: "Agora escolha a dificuldade Fácil para começar! Clique em Fácil.",
    textTarget: "Fácil", kind: "click" },
  { text: "Por último, selecione o deck Aleatório para o oponente — isso inicia o duelo!",
    textTarget: "Aleatório", kind: "click" },
  // ── Batalha: leitura, com buraco visual no que está sendo explicado ──────────
  { text: "Bem-vindo à mesa de duelo! Você e o oponente começam com a mesma quantidade de LP — Pontos de Vida. Quem chegar a zero primeiro, perde!",
    textTarget: null, kind: "info" },
  { text: "Essas são as cartas da sua mão. Cada tipo tem um papel: Unidades atacam, Tropas dão suporte, Action Funcions ativam poderes, Trap Funcions emboscam e Scenarios criam terrenos!",
    textTarget: "__PLAYER_HAND__", kind: "highlight" },
  { text: "O TAP é uma zona especial: a cada poucos turnos, uma carta extra aparece lá de graça! Fique de olho.",
    textTarget: "__PLAYER_TAP__", kind: "highlight" },
  // ── Batalha: agora clicks obrigatórios no botão real de ação do turno ───────
  // (mesmo botão físico muda de rótulo conforme a fase: draw → main → battle
  // — por isso mira pelo container __PHASE_BUTTON__, não pelo texto do rótulo)
  { text: "Chegou sua vez! Toque no botão em destaque para comprar sua carta.",
    textTarget: "__PHASE_BUTTON__", kind: "click" },
  { text: "Boa! Agora toque no botão em destaque para avançar para a Fase de Batalha.",
    textTarget: "__PHASE_BUTTON__", kind: "click" },
  { text: "Você está na Fase de Batalha! Se tiver uma carta em campo, arraste-a sobre o oponente para atacar. Quando terminar, toque no botão em destaque para finalizar o turno. Boa sorte, duelista!",
    textTarget: "__PHASE_BUTTON__", kind: "click" },
]

const POST_DUEL_STEPS = [


  { text: "Parabéns pelo duelo! Agora clique em GACHA para abrir seu primeiro pack de cartas!",
    textTarget: "GACHA", interceptClick: true },
]

const GACHA_STEPS = [
  { text: "Hora da recompensa! Este pack veio de graça só por ser seu primeiro dia aqui. Vamos abrir!",
    textTarget: null },
  { text: "Clique para abrir! Quem sabe que cartas raras vão aparecer para você...",
    textTarget: "GACHA x1", interceptClick: true },
  // Passo "fantasma": sem balão, sem escurecimento — a animação real do pack
  // (incluindo o swipe manual do jogador no primeiro pack) roda limpa, sem
  // nenhuma interferência visual do tutorial. Em vez de um tempo fixo (a
  // abertura tem duração variável), espera o "CONFIRMAR" da tela de
  // resultado aparecer de verdade no DOM antes de avançar.
  { text: "", textTarget: null, hidden: true, waitForText: "CONFIRMAR" },
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

function MasterBubble({ masterId, text, onNext, nextLabel = "Continuar ►", noButton, avoidPhaseButton }: {
  masterId: TutorialMasterId; text: string; onNext: () => void; nextLabel?: string; noButton?: boolean
  /**
   * Desvia o balão pra longe do botão real de ação de fase (Comprar Carta /
   * Ir para Batalha / Finalizar Turno), que fica fixo em
   * right: calc(clamp(140px,17vw,230px)+18px), width clamp(115px,9vw,138px)
   * — na mesma coluna direita onde também moram o LP do jogador e o LOG.
   * Só "descer" o balão não resolve: a arte do Mestre fica embaixo dele
   * empurrando-o pra cima, então a forma confiável de nunca cobrir o botão é
   * deslocar o balão inteiro pra depois dessa coluna, não só pra baixo.
   */
  avoidPhaseButton?: boolean
}) {
  const m = MASTERS[masterId]
  return (
    <div style={{
      position: "fixed", bottom: 0,
      right: avoidPhaseButton ? "calc(clamp(140px,17vw,230px) + 18px + clamp(115px,9vw,138px) + 16px)" : 0,
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      zIndex: 600, pointerEvents: "none",
      width: avoidPhaseButton ? "clamp(220px, 24vw, 320px)" : "clamp(240px, 27vw, 370px)",
      transition: "right 0.35s ease, width 0.35s ease",
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
        {!noButton && (
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
        )}
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

/**
 * Casos especiais "__PLAYER_HAND__" e "__PLAYER_TAP__": acham a mão e a zona
 * TAP do JOGADOR (não do oponente) por classe CSS única do duel-screen.tsx,
 * já que não têm um texto fixo e confiável pra buscar (a mão muda de cartas
 * a cada turno, e "TAP" aparece duas vezes na tela — uma pra cada lado).
 * Usa querySelector com atributo (em vez de seletor de classe direto) pra não
 * precisar escapar a barra do nome da classe do Tailwind (ex.: "group/tap").
 */
function findPlayerHand(pad = 14): PixelRect | null {
  const el = document.querySelector(".min-h-28")
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 10 || r.height < 10) return null
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
}

function findPlayerTap(pad = 10): PixelRect | null {
  const el = document.querySelector('[class*="group/tap"]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 10 || r.height < 10) return null
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
}

/**
 * Caso especial "__PHASE_BUTTON__": acha o botão real de ação de fase
 * (Comprar Carta / Ir para Batalha / Finalizar Turno) pelo container único
 * que o envolve, em vez de procurar pelo TEXTO do botão. O jogo tem dezenas
 * de habilidades de carta cujo texto também menciona "compre uma carta" e
 * afins (visíveis na mão/campo/log) — buscar por texto solto no DOM inteiro
 * corre o risco real de casar com uma dessas descrições em vez do botão de
 * verdade. O container (`fixed z-40 flex items-center justify-center`) é
 * usado só uma vez no arquivo inteiro, então é um alvo confiável independente
 * de qual rótulo o botão estiver mostrando no momento.
 */
function findPhaseButtonContainer(): HTMLElement | null {
  return document.querySelector('[class*="fixed z-40 flex items-center justify-center"]')
}

function findPhaseButton(pad = 10): PixelRect | null {
  const btn = findPhaseButtonContainer()?.querySelector("button")
  if (!btn) return null
  const r = btn.getBoundingClientRect()
  if (r.width < 10 || r.height < 10) return null
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
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
        textTarget === "__SIDEBAR__" ? findSidebar() :
        textTarget === "__PLAYER_HAND__" ? findPlayerHand() :
        textTarget === "__PLAYER_TAP__" ? findPlayerTap() :
        textTarget === "__PHASE_BUTTON__" ? findPhaseButton() :
        findByText(textTarget)
      setR(found)
    }

    update()
    const t = setInterval(update, 350)
    window.addEventListener("resize", update)
    return () => { clearInterval(t); window.removeEventListener("resize", update) }
  }, [textTarget])

  // Sem alvo (ou alvo ainda não achado no DOM): escurece E BLOQUEIA a tela
  // inteira — nada responde a clique enquanto não sabemos onde está o alvo real.
  if (!textTarget || !r) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.62)", zIndex: 400, pointerEvents: "all",
      }} />
    )
  }

  const { x, y, w, h } = r

  return (
    <>
      {/* Bloqueador full-screen: captura QUALQUER clique fora do alvo em
          destaque. Fica abaixo do captador de clique (z-index menor), então
          só a área do alvo responde — o resto do jogo real fica surdo a
          clique enquanto esse passo estiver ativo (nada de "clicar em outro
          canto" pra pular o passo). */}
      <div style={{
        position: "fixed", inset: 0,
        zIndex: 400, pointerEvents: "all", cursor: "not-allowed",
      }} />
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
      {/* Captador de clique transparente sobre o alvo — fica ACIMA do
          bloqueador full-screen (z-index maior: 401 > 400), então só essa
          área realmente responde a clique. */}
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


// ────────────────────────────────────────────────────────────────────────────────
// O antigo TutorialDuelSim (duelo 100% fake/roteirizado, com sua própria tela de
// seleção de deck e mesa de duelo simuladas) foi REMOVIDO. O tutorial agora usa
// o DuelScreen real do jogo — veja onNavigate("duel") e a prop postDuelReady na
// TutorialGameOverlay logo abaixo, além da integração em game-wrapper.tsx.
// ────────────────────────────────────────────────────────────────────────────────

export function TutorialGameOverlay({ masterId, onNavigate, onComplete, postDuelReady }: TutorialGameOverlayProps) {
  const [phase, setPhase] = useState<OverlayPhase>("menu")
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  /** true quando o jogador já passou por todos os DUEL_STEPS — a partir daí
   *  o duelo real roda 100% livre, sem nenhuma interferência visual do tutorial */
  const [duelStepsDone, setDuelStepsDone] = useState(false)

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
  // Dois modos: autoAdvanceMs (tempo fixo) ou waitForText (poll no DOM real até
  // o texto aparecer — usado no gacha, cuja animação tem duração variável e no
  // primeiro pack depende de um swipe manual do jogador). Rede de segurança de
  // 20s no modo waitForText pra nunca travar o tutorial pra sempre.
  useEffect(() => {
    // Não faz nada durante o duelo ou se não há autoAdvance/waitForText
    if (phase === "duel-sim") return
    const ms = (currentStep as any)?.autoAdvanceMs
    const waitText = (currentStep as any)?.waitForText as string | undefined
    if (!ms && !waitText) return

    const advance = () => {
      if (isLastStep) onComplete()
      else setStep(s => s + 1)
    }

    if (waitText) {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        clearInterval(poll)
        clearTimeout(safety)
        advance()
      }
      const poll = setInterval(() => { if (findByText(waitText)) finish() }, 300)
      const safety = setTimeout(finish, 20000)
      return () => { clearInterval(poll); clearTimeout(safety) }
    }

    const t = setTimeout(advance, ms)
    return () => clearTimeout(t)
  }, [step, phase, currentStep, isLastStep, onComplete])

  // ── Ao entrar em duel-sim: sinaliza game-wrapper para navegar ao duelo real ──────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase === "duel-sim") onNavigate("duel")
  }, [phase]) // omitimos onNavigate das deps — dispara só uma vez ao entrar na fase

  // ── Quando duelo real termina, game-wrapper seta postDuelReady=true ──────────
  // IMPORTANTE: game-wrapper.tsx NÃO desmonta entre tentativas do tutorial —
  // só o TutorialGameOverlay remonta. Se o jogador já tiver passado por um
  // duelo antes (ou saído de um), tutorialPostDuel pode chegar aqui já
  // "grudado" em true na primeiríssima renderização desta nova instância,
  // antes mesmo do reset (setTutorialPostDuel(false) dentro de onNavigate)
  // ter tido a chance de propagar de volta como prop. Uma checagem de nível
  // simples ("postDuelReady está true?") cai nessa corrida e pula pro
  // post-duel-menu na hora, com a mesa de setup real ainda na tela.
  // Por isso só reage à TRANSIÇÃO false → true, nunca a "já true": exige ver
  // o reset (false) passar por aqui pelo menos uma vez antes de aceitar um
  // true como sinal de verdade de fim de duelo.
  const sawResetRef = useRef(false)
  useEffect(() => {
    if (phase !== "duel-sim") { sawResetRef.current = false; return }
    if (!postDuelReady) { sawResetRef.current = true; return }
    if (sawResetRef.current) {
      setPhase("post-duel-menu")
      setStep(0)
    }
  }, [phase, postDuelReady])

  // ── Handlers (definidos antes de qualquer return) ───────────────────────────
  /** Acha o menor elemento real do DOM contendo `target` como texto e clica
   *  nele programaticamente — usado por todo passo "forçado" que precisa
   *  disparar uma ação real da tela por baixo do overlay (setup do duelo,
   *  botões de ação do turno, abrir o pack no gacha). */
  const clickRealElement = (target: string | null | undefined) => {
    if (!target) return
    const tNorm = normText(target)
    let found: HTMLElement | null = null
    let foundArea = Infinity
    document.querySelectorAll("button, a, li, [role='button'], div, span, p").forEach(el => {
      const elText = normText(el.textContent ?? "")
      if (elText.includes(tNorm) && elText.length > 0 && elText.length <= tNorm.length * 6) {
        const r = el.getBoundingClientRect()
        const area = r.width * r.height
        if (r.width > 10 && r.height > 8 && r.top >= 0 && area < foundArea) {
          found = el as HTMLElement; foundArea = area
        }
      }
    })
    if (found) (found as HTMLElement).click()
  }

  const handleInterceptClick = () => {
    if (phase === "menu") {
      setPhase("duel-sim")
      setStep(0)
      setDuelStepsDone(false)
    } else if (phase === "post-duel-menu") {
      onNavigate("gacha")
      setPhase("gacha")
      setStep(0)
    } else if (phase === "gacha") {
      // Clique real no botão "GACHA x1" — dispara pullGacha() de verdade
      // (concede as cartas na hora) e deixa a animação real rolar. O passo
      // fantasma seguinte espera o "CONFIRMAR" da tela de resultado aparecer.
      clickRealElement(currentStep?.textTarget ?? null)
      setStep(s => s + 1)
    }
  }

  // ── Duelo: click obrigatório no elemento real do DuelScreen + avanço ────────
  const handleDuelInterceptClick = () => {
    const target = DUEL_STEPS[step]?.textTarget
    const isLastDuelStep = step === DUEL_STEPS.length - 1

    if (target === "__PHASE_BUTTON__") {
      // Botão de ação de fase: clica pelo container (não por texto) e
      // confirma comparando o PRÓPRIO rótulo do botão antes/depois — muito
      // mais confiável do que vasculhar o DOM inteiro atrás de um texto que
      // também aparece em descrições de habilidade de carta.
      const before = findPhaseButtonContainer()?.querySelector("button")?.textContent ?? null
      findPhaseButtonContainer()?.querySelector("button")?.click()

      if (isLastDuelStep) {
        // Finalizar Turno: fim do turno guiado, libera o duelo. Se o clique
        // não pegar, o botão continua ali, 100% clicável normalmente assim
        // que duelStepsDone vira true — não precisa de confirmação extra.
        setDuelStepsDone(true)
        return
      }

      let tries = 0
      const check = () => {
        tries++
        const now = findPhaseButtonContainer()?.querySelector("button")?.textContent ?? null
        if (now !== before || tries >= 10) { setStep(s => s + 1); return }
        findPhaseButtonContainer()?.querySelector("button")?.click()
        setTimeout(check, 300)
      }
      setTimeout(check, 300)
      return
    }

    // Setup (Deck Inicial / Fácil / Aleatório): textos únicos o bastante
    // (nome do deck, "Fácil", "Aleatório") pra não colidir com nenhuma
    // descrição de carta, então a busca por texto solto continua segura aqui.
    clickRealElement(target)
    let tries = 0
    const check = () => {
      tries++
      if (!target || !findByText(target) || tries >= 10) {
        setStep(s => s + 1)
        return
      }
      clickRealElement(target)
      setTimeout(check, 300)
    }
    setTimeout(check, 300)
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

  // ── Fase duel-sim: guia por cima do DuelScreen real ────────────────────────────
  // • Passo com textTarget: DynamicSpotlight bloqueia tudo, abre buraco só no
  //   alvo, intercepta o clique e replica no elemento real (handleDuelInterceptClick).
  //   Cobre tanto o setup (deck/dificuldade/oponente) quanto as ações de
  //   batalha (comprar carta/avançar fase/finalizar turno) — handleDuelInterceptClick
  //   decide se avança um passo, dá um respiro pro startGame(), ou libera o duelo.
  // • Passo sem textTarget (só leitura): div escuro bloqueante até Entendido ►.
  if (phase === "duel-sim") {
    const duelStep = DUEL_STEPS[step]
    // Só os 3 passos que apontam pro botão físico de ação de fase precisam
    // desviar o balão — os de setup (Deck/Fácil/Aleatório) não têm esse problema.
    const avoidBtn = duelStep?.textTarget === "__PHASE_BUTTON__"
    return (
      <>
        <style>{TUTORIAL_CSS}</style>
        {!duelStepsDone && duelStep && (
          duelStep.kind === "click" ? (
            // ── Clique obrigatório: spotlight + intercept (sem botão no balão) ───
            <>
              <DynamicSpotlight
                textTarget={duelStep.textTarget}
                onInterceptClick={handleDuelInterceptClick}
              />
              <MasterBubble
                masterId={masterId}
                text={duelStep.text}
                onNext={() => {}}
                noButton
                avoidPhaseButton={avoidBtn}
              />
            </>
          ) : duelStep.kind === "highlight" ? (
            // ── Leitura com buraco visual (mão/TAP ficam com opacidade normal) ───
            <>
              <DynamicSpotlight textTarget={duelStep.textTarget} />
              <MasterBubble
                masterId={masterId}
                text={duelStep.text}
                onNext={() => setStep(s => s + 1)}
                nextLabel="Entendido ►"
              />
            </>
          ) : (
            // ── Só leitura: overlay escuro bloqueia o duelo até o jogador confirmar ──
            <>
              <div style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.72)",
                zIndex: 399, pointerEvents: "all",
              }} />
              <MasterBubble
                masterId={masterId}
                text={duelStep.text}
                onNext={() => setStep(s => s + 1)}
                nextLabel="Entendido ►"
              />
            </>
          )
        )}
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
                ? `👆 Clique no botão ${currentStep?.textTarget ?? ""} acima`
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
