/**
 * SKIP TÍQUETE — item que permite pular um duelo de Evento.
 *
 * Onde é obtido:
 *  - Bônus de Conclusão das missões DIÁRIAS da tela de Missões (3 tíquetes)
 *  - Bônus de Conclusão das missões SEMANAIS da tela de Missões (7 tíquetes)
 *  - Bônus Diário do menu principal, junto das Gacha Coins (2 tíquetes)
 * (não confundir com as missões do Gear Pass).
 *
 * Onde é usado: na seleção de fases de um Evento. Se o jogador tiver ao menos
 * 1 tíquete, aparece a opção "Pular com Tíquete" abaixo de Duelar/Rejogar; ao
 * usar, o duelo é pulado e a tela de vitória da fase é exibida normalmente,
 * com todas as recompensas (Gacha Coins, Gear Coins, fragmentos, XP de Mestre).
 */

export const SKIP_TICKET_IMAGE = "/images/skip-ticket.png"
export const SKIP_TICKET_NAME = "Skip Tíquete"
export const SKIP_TICKET_DESCRIPTION =
  "Pula um duelo de Evento e entrega as recompensas da fase. Ganho nos bônus das missões diárias/semanais e no Bônus Diário."
/** Cor de destaque do item (holográfico gelo/azul). */
export const SKIP_TICKET_COLOR = "#7dd3fc"
/** Quantos tíquetes o bônus de conclusão das missões DIÁRIAS entrega. */
export const SKIP_TICKET_DAILY_BONUS = 3
/** Quantos tíquetes o bônus de conclusão das missões SEMANAIS entrega. */
export const SKIP_TICKET_WEEKLY_BONUS = 7
/** Quantos tíquetes o Bônus Diário do menu principal entrega (junto das coins). */
export const SKIP_TICKET_LOGIN_BONUS = 2
