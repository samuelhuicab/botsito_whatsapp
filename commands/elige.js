// !elige a, b, c — elige una opción al azar (para cuando el grupo no se decide).

/**
 * "pizza, tacos o sushi" → ['pizza', 'tacos', 'sushi']
 * @param {string} text
 */
export function parseOptions(text) {
  return String(text ?? '')
    .split(/\s*(?:,|\||\n|\so\s|\sor\s)\s*/i)
    .map((option) => option.trim())
    .filter(Boolean);
}

export default {
  name: 'elige',
  aliases: ['escoge', 'decide'],
  description: 'Elige al azar entre varias opciones',
  usage: '!elige pizza, tacos o sushi',
  cooldownSeconds: 3,

  async run(ctx, random = Math.random) {
    const options = parseOptions(ctx.text);
    if (options.length < 2) {
      await ctx.reply(
        `Dame al menos 2 opciones, ej. ${ctx.bot.prefix}elige pizza, tacos o sushi 🎲`,
      );
      return;
    }
    const choice = options[Math.floor(random() * options.length)];
    await ctx.reply(`🎲 Elijo… *${choice}*`);
  },
};
