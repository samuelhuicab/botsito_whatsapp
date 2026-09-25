// !cambio [cantidad] [de] [a] — tipo de cambio con open.er-api.com (gratis, sin clave, 160+ monedas).
// Ejemplos: !cambio  ·  !cambio 100  ·  !cambio 50 eur  ·  !cambio 20 usd cop

const RATES_URL = 'https://open.er-api.com/v6/latest';
const DEFAULT_FROM = 'USD';
const DEFAULT_TO = 'MXN';

// Nombres comunes → código ISO.
const ALIASES = {
  dolar: 'USD',
  dolares: 'USD',
  euro: 'EUR',
  euros: 'EUR',
  peso: 'MXN',
  pesos: 'MXN',
  mexicano: 'MXN',
  argentino: 'ARS',
  colombiano: 'COP',
  chileno: 'CLP',
  sol: 'PEN',
  soles: 'PEN',
  libra: 'GBP',
  libras: 'GBP',
  yen: 'JPY',
  yenes: 'JPY',
  real: 'BRL',
  reales: 'BRL',
  quetzal: 'GTQ',
  quetzales: 'GTQ',
};

function toCurrency(word) {
  const clean = word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (ALIASES[clean]) return ALIASES[clean];
  return /^[a-z]{3}$/.test(clean) ? clean.toUpperCase() : null;
}

/**
 * Interpreta los argumentos. Devuelve { amount, from, to } o { error }.
 * @param {string[]} args
 */
export function parseExchangeArgs(args) {
  let amount = 1;
  const rest = [...args].filter((a) => !['a', 'en', 'to', 'de'].includes(a.toLowerCase()));

  if (rest.length > 0) {
    const maybeNumber = Number(rest[0].replace(/[$,]/g, ''));
    if (Number.isFinite(maybeNumber)) {
      if (maybeNumber <= 0) return { error: 'La cantidad debe ser mayor a 0' };
      amount = maybeNumber;
      rest.shift();
    }
  }

  const currencies = rest.map(toCurrency);
  const bad = rest.find((_, i) => !currencies[i]);
  if (bad) return { error: `No conozco la moneda "${bad}". Usa códigos como USD, MXN, EUR, COP` };
  if (currencies.length > 2) return { error: 'Solo dime cantidad, moneda de origen y destino' };

  const from = currencies[0] ?? DEFAULT_FROM;
  const to = currencies[1] ?? (from === DEFAULT_TO ? DEFAULT_FROM : DEFAULT_TO);
  return { amount, from, to };
}

function formatMoney(value, currency) {
  const digits = Math.abs(value) >= 1 ? 2 : 6;
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: digits })} ${currency}`;
}

export default {
  name: 'cambio',
  aliases: ['dolar', 'divisa'],
  description: 'Tipo de cambio entre monedas',
  usage: '!cambio [cantidad] [de] [a] (ej. !cambio 100 usd mxn)',
  cooldownSeconds: 10,

  async run(ctx) {
    const parsed = parseExchangeArgs(ctx.args);
    if (parsed.error) {
      await ctx.reply(`${parsed.error} 🤔`);
      return;
    }
    const { amount, from, to } = parsed;

    let data;
    try {
      data = await ctx.http.get(`${RATES_URL}/${from}`);
    } catch (err) {
      ctx.log.warn({ status: err.status, err: err.message }, 'Falló la API de tipo de cambio');
      await ctx.reply(
        err.status === 404
          ? `No conozco la moneda ${from} 🤔`
          : 'No pude consultar el tipo de cambio ahorita 😅',
      );
      return;
    }

    const rate = data?.rates?.[to];
    if (data?.result !== 'success' || !rate) {
      await ctx.reply(`No tengo el cambio de ${from} a ${to} 🤔`);
      return;
    }

    const updated = data.time_last_update_unix
      ? new Date(data.time_last_update_unix * 1000).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
        })
      : null;

    await ctx.reply(
      [
        `💱 *${formatMoney(amount, from)}* = *${formatMoney(amount * rate, to)}*`,
        `_1 ${from} = ${formatMoney(rate, to)}${updated ? ` · actualizado ${updated}` : ''}_`,
        '_Fuente: exchangerate-api.com_',
      ].join('\n'),
    );
  },
};
