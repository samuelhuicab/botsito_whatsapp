// !ping — para saber si el bot está vivo.

const startedAt = Date.now();

function formatUptime(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default {
  name: 'ping',
  description: 'Revisa si el bot está vivo',
  async run(ctx) {
    await ctx.reply(`🏓 ¡Pong! Llevo ${formatUptime(Date.now() - startedAt)} despierto.`);
  },
};
