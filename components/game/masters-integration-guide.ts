// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUÇÕES DE INTEGRAÇÃO — Sistema de Mestres
// Gear Perks Card Game
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. ARQUIVOS CRIADOS ──────────────────────────────────────────────────────
//
//  components/game/master-screen.tsx   → Tela principal dos Mestres
//  lib/masters-data.ts                 → Dados, XP table, helpers
//
// ─── 2. IMAGENS NECESSÁRIAS ──────────────────────────────────────────────────
//
//  Crie a pasta: public/images/masters/
//  Coloque os arquivos:
//
//  fehnon-art.png    → Fehnon Hoskie full body (fundo transparente)
//  fehnon-icon.png   → Fehnon rosto 200×200px (circular)
//
//  morgana-art.png   → Morgana Pendragon full body (fundo transparente)
//  morgana-icon.png  → Morgana rosto 200×200px (circular)
//
//  calem-art.png     → Calem Hidenori full body (fundo transparente)
//  calem-icon.png    → Calem rosto 200×200px (circular)
//
//  Os 3 personagens que você enviou nos prints são perfeitos para o artPath.
//  Para o iconPath, use um crop do rosto de cada um.

// ─── 3. ADICIONAR ROTA NO game-wrapper.tsx ───────────────────────────────────

/*
// Em game-wrapper.tsx, adicione "masters" ao tipo GameScreen:

export type GameScreen =
  | "menu"
  | "gacha"
  | "collection"
  | "deck-builder"
  | "duel-bot"
  | "duel-player"
  | "duel-draft"
  | "duel-roguelike"
  | "duel-catastrophe"
  | "history"
  | "settings"
  | "create-room"
  | "join-room"
  | "friends"
  | "shop"
  | "profile"
  | "missions"
  | "gear-pass"
  | "story"
  | "guild"
  | "masters"          // ← ADICIONE ESTA LINHA

// No JSX do GameWrapper, adicione ao lado dos outros screens:
  {currentScreen === "masters" && (
    <MasterScreen onBack={() => navigateTo("menu")} />
  )}

// E importe no topo:
  import MasterScreen from "./master-screen"
*/

// ─── 4. ADICIONAR CARD DO MESTRE NO main-menu.tsx ────────────────────────────
//
// No topo do menu principal, ao lado do stamina/coins, adicione o MasterMenuCard.
// Exemplo de uso (cole no main-menu.tsx):

/*
import { MasterMenuCard } from "./master-screen"

// Dentro do JSX do MainMenu, no header superior esquerdo:
<MasterMenuCard onOpen={() => onNavigate("masters")} />
*/

// ─── 5. CONCEDER XP APÓS DUELOS ──────────────────────────────────────────────
//
// No duel-screen.tsx, após o resultado do duelo, chame a função abaixo.
// Importe de masters-data:

/*
import {
  loadMastersFromStorage,
  saveMastersToStorage,
  calcMasterXP,
  xpRequiredForLevel,
} from "@/lib/masters-data"

// Após determinar resultado do duelo:
function grantMasterXP(won: boolean, opponentLevel: number, duelMode: string) {
  const masters = loadMastersFromStorage()
  const xpGain  = calcMasterXP({ won, opponentLevel, duelMode: duelMode as any })

  const updated = masters.map(m => {
    if (!m.isActive) return m

    let xp    = m.currentXP + xpGain
    let level = m.currentLevel

    while (level < m.maxLevel) {
      const needed = xpRequiredForLevel(level)
      if (xp >= needed) { xp -= needed; level++ }
      else break
    }

    return { ...m, currentXP: xp, currentLevel: level, totalXP: m.totalXP + xpGain, xpToNext: xpRequiredForLevel(level) }
  })

  saveMastersToStorage(updated)

  // Return XP gained and whether leveled up (for UI display)
  const active    = updated.find(m => m.isActive)
  const previous  = masters.find(m => m.isActive)
  const leveledUp = active && previous && active.currentLevel > previous.currentLevel

  return { xpGain, leveledUp, newLevel: active?.currentLevel }
}
*/

// ─── 6. MOSTRAR XP NA TELA DE RESULTADO ──────────────────────────────────────
//
// Na tela de resultado do duelo (fim de batalha), adicione algo como:
//
//   const result = grantMasterXP(won, opponentLevel, "pve")
//
//   <div>
//     ⭐ {activeMasterName} +{result.xpGain} XP
//     {result.leveledUp && <span>🎉 NÍVEL {result.newLevel}!</span>}
//   </div>

// ─── 7. ADICIONAR AO MENU PRINCIPAL (botão de navegação) ─────────────────────
//
// No main-menu.tsx, dentro dos botões do menu lateral direito, adicione:

/*
<button onClick={() => onNavigate("masters")} style={{...}}>
  <span>⭐</span>
  <span>MESTRES</span>
</button>
*/

// ─── 8. ADICIONAR AO MISSIONS SCREEN ─────────────────────────────────────────
//
// Sugestão de missões diárias relacionadas aos Mestres:
// - "Ganhe 500 XP com qualquer Mestre" → recompensa: 50 moedas
// - "Suba 1 nível com seu Mestre" → recompensa: 1 pack comum
// - "Vença 3 duelos com Mestre Ativo" → recompensa: 20 gems

// ─── 9. SALVAR PROGRESSO COM SUPABASE (OPCIONAL) ─────────────────────────────
//
// Os dados de Mestres atualmente usam localStorage.
// Para sincronizar entre dispositivos, crie uma tabela no Supabase:
//
// CREATE TABLE IF NOT EXISTS public.master_progress (
//   player_id    TEXT NOT NULL,
//   master_id    TEXT NOT NULL,
//   level        INTEGER NOT NULL DEFAULT 1,
//   current_xp   INTEGER NOT NULL DEFAULT 0,
//   total_xp     INTEGER NOT NULL DEFAULT 0,
//   is_active    BOOLEAN NOT NULL DEFAULT false,
//   rewards_json JSONB,
//   PRIMARY KEY (player_id, master_id)
// );
//
// E substitua as chamadas de loadMastersFromStorage/saveMastersToStorage
// por fetch() para o Supabase REST API (mesmo padrão do guild-screen).

// ─── 10. RESUMO DA ESTRUTURA DE ARQUIVOS ─────────────────────────────────────
//
//  public/
//    images/
//      masters/
//        fehnon-art.png
//        fehnon-icon.png
//        morgana-art.png
//        morgana-icon.png
//        calem-art.png
//        calem-icon.png
//
//  lib/
//    masters-data.ts           ← dados e helpers
//
//  components/
//    game/
//      master-screen.tsx       ← tela completa
//      game-wrapper.tsx        ← adicionar rota "masters"
//      main-menu.tsx           ← adicionar MasterMenuCard e botão
//      duel-screen.tsx         ← chamar grantMasterXP() no resultado
