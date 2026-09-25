// !ayuda — lista de comandos, generada sola a partir de cada comando.
// 🤖 = usa IA · 🔒 = comando privado (solo existe en este servidor)

function badges(command) {
  return `${command.usesAI ? ' 🤖' : ''}${command.isPrivate ? ' 🔒' : ''}`;
}

export default {
  name: 'ayuda',
  aliases: ['help', 'comandos'],
  description: 'Muestra los comandos disponibles',
  usage: '!ayuda [comando]',
  async run(ctx) {
    const { prefix, name } = ctx.bot;
    const visible = ctx.commands.filter((c) => ctx.isOwner || !c.ownerOnly);

    // !ayuda <comando> → detalle de uno
    if (ctx.args[0]) {
      const wanted = ctx.args[0].replace(prefix, '').toLowerCase();
      const command = visible.find((c) => c.name === wanted || c.aliases.includes(wanted));
      if (!command) {
        await ctx.reply(`No conozco ese comando 🤔 Escribe ${prefix}ayuda para ver la lista.`);
        return;
      }
      const lines = [`*${prefix}${command.name}*${badges(command)}`];
      if (command.description) lines.push(command.description);
      lines.push(`Uso: ${command.usage ?? prefix + command.name}`);
      if (command.aliases.length > 0) {
        lines.push(`También: ${command.aliases.map((a) => prefix + a).join(', ')}`);
      }
      if (command.groupOnly) lines.push('Solo en grupos 👥');
      await ctx.reply(lines.join('\n'));
      return;
    }

    const list = visible.map(
      (c) => `• *${prefix}${c.name}*${badges(c)}${c.description ? ` — ${c.description}` : ''}`,
    );
    await ctx.reply(
      [
        `👋 Soy *${name}*. Esto es lo que sé hacer:`,
        '',
        ...list,
        '',
        `Más detalle: ${prefix}ayuda <comando>`,
        '🤖 usa IA · 🔒 comando privado',
      ].join('\n'),
    );
  },
};
