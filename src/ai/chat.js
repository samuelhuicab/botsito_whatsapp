// Modo plática: cuando le hablan al bot por su nombre o lo mencionan.
// Guarda en memoria los últimos AI_HISTORY_SIZE mensajes de cada chat para que tenga contexto.

import { buildSystemPrompt, defaultPersonality } from './prompts.js';

/** Máximo de chats con historial en memoria (se olvida el más viejo). */
const MAX_CHATS = 500;

/**
 * @param {object} deps
 * @param {ReturnType<import('./router.js').createRouter>} deps.router
 * @param {number} deps.historySize
 * @param {string} deps.botName
 * @param {string} [deps.personality]  system prompt (privado o público); por defecto el público
 * @param {{ text: string, chance: number }[]} [deps.randomReplies]  respuestas al azar sin IA
 * @param {() => number} [deps.random]  para tests
 */
export function createChat({
  router,
  historySize,
  botName,
  personality = defaultPersonality({ botName }),
  randomReplies = [],
  random = Math.random,
}) {
  /** chatId → [{ role, content }] */
  const histories = new Map();

  function getHistory(chatId) {
    const history = histories.get(chatId) ?? [];
    // Reinsertar para que el Map quede ordenado del menos al más reciente.
    histories.delete(chatId);
    histories.set(chatId, history);
    if (histories.size > MAX_CHATS) histories.delete(histories.keys().next().value);
    return history;
  }

  function remember(history, ...entries) {
    history.push(...entries);
    if (history.length > historySize) history.splice(0, history.length - historySize);
  }

  /**
   * Responde a un mensaje en modo plática.
   * @param {import('../whatsapp/client.js').NormalizedMessage} message
   * @param {string} text  mensaje sin el nombre del bot
   */
  return async function chat(message, text) {
    // Respuestas al azar (ej. "the game"): se mandan tal cual, sin gastar IA.
    for (const { text: reply, chance } of randomReplies) {
      if (random() < chance) {
        await message.reply(reply);
        return;
      }
    }

    if (!text.trim()) {
      await message.reply(
        `¿Qué onda? 👋 Escríbeme algo después de mi nombre, ej. "${botName} cuéntame un chiste"`,
      );
      return;
    }

    const { isGroup } = message.chat;
    const userContent = isGroup ? `${message.sender.name ?? 'Alguien'}: ${text}` : text;
    const history = getHistory(message.chat.id);

    await message.typing?.();
    const { text: answer, provider } = await router.complete([
      { role: 'system', content: buildSystemPrompt({ personality, isGroup }) },
      ...history,
      { role: 'user', content: userContent },
    ]);

    // Solo se guarda si de verdad respondió la IA (no los avisos de error).
    if (provider) {
      remember(
        history,
        { role: 'user', content: userContent },
        { role: 'assistant', content: answer },
      );
    }
    await message.reply(answer);
  };
}
