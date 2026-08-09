/**
 * GARRAFA DE ENERGIA — item consumível que recupera stamina do jogador.
 *
 * Onde é obtido: no Bônus Diário do menu principal, junto das Gacha Coins e
 * dos Skip Tíquetes.
 *
 * Onde é usado: na tela de Inventário (opção "Itens" do menu principal). O
 * botão "Usar" só fica disponível quando o jogador está faltando 10 ou mais
 * pontos de stamina para completar a barra (evita desperdiçar o item enchendo
 * uma barra que já está quase cheia).
 */

export const STAMINA_BOTTLE_IMAGE = "/images/items/stamina-bottle.png"
export const STAMINA_BOTTLE_NAME = "Garrafa de Energia"
export const STAMINA_BOTTLE_DESCRIPTION =
  "Recupera 10 de stamina. Só pode ser usada faltando 10 ou mais na barra. Ganha no Bônus Diário."
/** Cor de destaque do item (azul de água/energia). */
export const STAMINA_BOTTLE_COLOR = "#60a5fa"
/** Quantos pontos de stamina cada garrafa recupera. */
export const STAMINA_BOTTLE_REFILL_AMOUNT = 10
/** Quantidade mínima de stamina faltando na barra para poder usar a garrafa. */
export const STAMINA_BOTTLE_MIN_MISSING = 10
/** Quantas garrafas o Bônus Diário do menu principal entrega. */
export const STAMINA_BOTTLE_LOGIN_BONUS = 1
