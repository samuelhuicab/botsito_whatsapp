// !recuerda <tiempo> <texto> — te avisa en el chat después de un rato.
// Los recordatorios viven en memoria: si el bot se reinicia, se pierden.

const MIN_SECONDS = 10;
const MAX_SECONDS = 24 * 60 * 60;
const MAX_PER_USER = 5;

/** senderId → cantidad de recordatorios pendientes */
const pending = new Map();

/**
 * "10m", "1h30m", "90s", "2h" → segundos. null si no se entiende.
 * @param {string} text
 */
export function parseDuration(text) {
  const clean = String(text ?? '')
    .toLowerCase()
    .trim();
  if (!/^(\d+\s*[hms])+$/.test(clean.replace(/\s+/g, ''))) return null;
  let seconds = 0;
  for (const [, value, unit] of clean.replace(/\s+/g, '').matchAll(/(\d+)([hms])/g)) {
    seconds += Number(value) * { h: 3600, m: 60, s: 1 }[unit];
  }
  return seconds;
}

/** 5400 → "1h 30m" */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

export default {
  name: 'recuerda',
  aliases: ['recordar', 'recordatorio'],
  description: 'Te recuerda algo después de un tiempo',
  usage: '!recuerda <tiempo> <texto> (ej. !recuerda 30m sacar la pizza)',
  cooldownSeconds: 5,

  async run(ctx) {
    const [time, ...words] = ctx.args;
    const seconds = parseDuration(time);
    const what = words.join(' ').trim();

    if (!seconds || !what) {
      await ctx.reply(
        `Así: ${ctx.bot.prefix}recuerda 30m sacar la pizza ⏰\nTiempos: 90s, 10m, 2h, 1h30m`,
      );
      return;
    }
    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
      await ctx.reply('El tiempo debe ser entre 10 segundos y 24 horas ⏳');
      return;
    }

    const count = pending.get(ctx.sender.id) ?? 0;
    if (count >= MAX_PER_USER) {
      await ctx.reply(`Ya tienes ${MAX_PER_USER} recordatorios pendientes, espera a que salgan 😅`);
      return;
    }
    pending.set(ctx.sender.id, count + 1);

    setTimeout(async () => {
      const left = (pending.get(ctx.sender.id) ?? 1) - 1;
      if (left > 0) pending.set(ctx.sender.id, left);
      else pending.delete(ctx.sender.id);
      try {
        const who = ctx.sender.name ? `, ${ctx.sender.name}` : '';
        await ctx.reply(`⏰ ¡Recordatorio${who}! ${what}`);
      } catch (err) {
        ctx.log.warn({ err: err.message }, 'No se pudo mandar el recordatorio');
      }
    }, seconds * 1000);

    await ctx.reply(`Va, te recuerdo en ${formatDuration(seconds)} ⏰`);
  },
};
