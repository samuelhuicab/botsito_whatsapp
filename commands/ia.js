// !ia — ejemplo de comando que usa la IA con ctx.ai.

export default {
  name: 'ia',
  aliases: ['pregunta'],
  description: 'Hazle una pregunta a la IA',
  usage: '!ia <pregunta>',
  usesAI: true,

  async run(ctx) {
    if (!ctx.text) {
      await ctx.reply(`Escribe tu pregunta, ej. ${ctx.bot.prefix}ia ¿por qué el cielo es azul?`);
      return;
    }
    await ctx.typing();
    const answer = await ctx.ai.ask(ctx.text, {
      system: `Eres ${ctx.bot.name}, un bot de WhatsApp. Responde en español, claro y en máximo 4 frases. Usa formato de WhatsApp (*negritas*), sin Markdown con #.`,
    });
    await ctx.reply(answer);
  },
};
