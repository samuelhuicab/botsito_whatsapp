// Arma el objeto ctx que recibe cada comando en run(ctx).

import { createLogger } from '../utils/logger.js';

/** ctx.ai para comandos sin usesAI: avisa al programador en vez de gastar cuota sin cooldown. */
function aiNotAllowed(commandName) {
  const fail = () => {
    throw new Error(`El comando "${commandName}" usa ctx.ai pero no tiene usesAI: true`);
  };
  return { ask: fail, configured: false };
}

/**
 * @param {object} options
 * @param {import('../whatsapp/client.js').NormalizedMessage} options.message
 * @param {object} options.command
 * @param {string[]} options.args
 * @param {string} options.text
 * @param {boolean} options.isOwner
 * @param {{ name: string, prefix: string }} options.bot
 * @param {object[]} options.commands   lista de comandos (para !help)
 * @param {object} [options.services]   { http, ai }
 */
export function createContext({ message, command, args, text, isOwner, bot, commands, services }) {
  return {
    reply: (content) => message.reply(content),
    react: (emoji) => message.react(emoji),
    typing: () => message.typing?.() ?? Promise.resolve(),
    args,
    text,
    sender: { id: message.sender.id, name: message.sender.name },
    chat: { ...message.chat },
    isOwner,
    bot,
    commands,
    http: services?.http,
    ai: command.usesAI ? services?.ai : aiNotAllowed(command.name),
    env: process.env,
    log: createLogger(`cmd:${command.name}`),
  };
}
