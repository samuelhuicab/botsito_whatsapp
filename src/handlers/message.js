// "Portero": decide qué hacer con cada mensaje.
// 1. Comando (empieza con el prefijo) → validar y ejecutar.
// 2. Le hablan al bot (trigger o mención) → modo plática.
// 3. Cualquier otra cosa → nada (no gastar nada).

import { createContext } from '../core/context.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('handler');

/** Cooldown por comando si el comando no define uno. */
const DEFAULT_COOLDOWN_SECONDS = 3;

/**
 * "!rank  juan 2" → { name: 'rank', args: ['juan', '2'], text: 'juan 2' }. null si no es comando.
 * @param {string} body
 * @param {string} prefix
 */
export function parseCommand(body, prefix) {
  if (!body.startsWith(prefix)) return null;
  const rest = body.slice(prefix.length).trim();
  if (!rest) return null;
  const [name, ...args] = rest.split(/\s+/);
  const text = rest.slice(name.length).trim();
  return { name: name.toLowerCase(), args, text };
}

/**
 * ¿El mensaje empieza con la palabra trigger? ("bot ¿qué onda?" sí, "botella" no).
 * Devuelve el texto sin el trigger, o null si no aplica.
 * @param {string} body
 * @param {string} trigger  en minúsculas
 */
export function stripTrigger(body, trigger) {
  const trimmed = body.trimStart();
  if (!trigger || !trimmed.toLowerCase().startsWith(trigger)) return null;
  const next = trimmed.charAt(trigger.length);
  if (next && /[\p{L}\p{N}_]/u.test(next)) return null;
  return trimmed
    .slice(trigger.length)
    .replace(/^[\s,.:!?-]+/, '')
    .trim();
}

/**
 * Compara teléfonos tolerando el "1" extra de México (521XXXXXXXXXX = 52XXXXXXXXXX).
 * @param {string | null} a
 * @param {string | null} b
 */
export function samePhone(a, b) {
  if (!a || !b) return false;
  const canonical = (phone) => (/^521\d{10}$/.test(phone) ? `52${phone.slice(3)}` : phone);
  return canonical(a) === canonical(b);
}

/**
 * @param {object} deps
 * @param {{ list: object[], find: (name: string) => object | undefined }} deps.registry
 * @param {object} deps.config
 * @param {ReturnType<import('../core/cooldown.js').createCooldowns>} deps.cooldowns
 * @param {object} [deps.services]  { http, ai, chat } cuando existan
 */
export function createMessageHandler({ registry, config, cooldowns, services = {} }) {
  const { bot, ai } = config;
  const botInfo = { name: bot.name, prefix: bot.commandPrefix };

  function isOwner(message) {
    return samePhone(message.sender.phone, bot.ownerNumber);
  }

  async function handleCommand(message, parsed) {
    const command = registry.find(parsed.name);
    if (!command) return;

    await message.resolve();
    const owner = isOwner(message);

    if (command.ownerOnly && !owner) {
      await message.reply('Ese comando es solo para el dueño del bot 🔒');
      return;
    }
    if (command.groupOnly && !message.chat.isGroup) {
      await message.reply('Ese comando solo funciona en grupos 👥');
      return;
    }

    if (!owner) {
      const wait =
        cooldowns.hit(
          `cmd:${command.name}:${message.sender.id}`,
          command.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS,
        ) || (command.usesAI ? cooldowns.hit(`ai:${message.sender.id}`, ai.userCooldown) : 0);
      if (wait > 0) {
        await message.reply(`Tranqui, espera ${wait}s ⏳`);
        return;
      }
    }

    const ctx = createContext({
      message,
      command,
      args: parsed.args,
      text: parsed.text,
      isOwner: owner,
      bot: botInfo,
      commands: registry.list,
      services,
    });

    try {
      await command.run(ctx);
    } catch (err) {
      log.error({ command: command.name, err: err.message }, 'El comando falló');
      await message.reply('Algo salió mal 😅').catch(() => {});
    }
  }

  async function handleChat(message, text) {
    if (!services.chat) return; // el modo plática llega en el paso de IA

    await message.resolve();
    if (!isOwner(message)) {
      const wait = cooldowns.hit(`ai:${message.sender.id}`, ai.userCooldown);
      if (wait > 0) {
        await message.react('⏳').catch(() => {});
        return;
      }
    }

    try {
      await services.chat(message, text);
    } catch (err) {
      log.error({ err: err.message }, 'Falló el modo plática');
      await message.reply('Algo salió mal 😅').catch(() => {});
    }
  }

  return async function handleMessage(message) {
    if (message.fromMe || message.chat.id === 'status@broadcast') return;

    const parsed = parseCommand(message.body, bot.commandPrefix);
    if (parsed) {
      await handleCommand(message, parsed);
      return;
    }

    const triggered = stripTrigger(message.body, bot.trigger);
    if (triggered !== null) {
      await handleChat(message, triggered);
    } else if (message.mentionsBot) {
      await handleChat(message, message.body);
    }
  };
}
