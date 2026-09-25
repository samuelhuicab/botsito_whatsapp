// !clima <ciudad> — clima actual y del día con Open-Meteo (gratis, sin clave).

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Códigos WMO → descripción y emoji.
const WEATHER = {
  0: ['Despejado', '☀️'],
  1: ['Casi despejado', '🌤️'],
  2: ['Parcialmente nublado', '⛅'],
  3: ['Nublado', '☁️'],
  45: ['Niebla', '🌫️'],
  48: ['Niebla con escarcha', '🌫️'],
  51: ['Llovizna ligera', '🌦️'],
  53: ['Llovizna', '🌦️'],
  55: ['Llovizna intensa', '🌧️'],
  56: ['Llovizna helada', '🌧️'],
  57: ['Llovizna helada intensa', '🌧️'],
  61: ['Lluvia ligera', '🌦️'],
  63: ['Lluvia', '🌧️'],
  65: ['Lluvia fuerte', '🌧️'],
  66: ['Lluvia helada', '🌧️'],
  67: ['Lluvia helada fuerte', '🌧️'],
  71: ['Nevada ligera', '🌨️'],
  73: ['Nevada', '🌨️'],
  75: ['Nevada fuerte', '❄️'],
  77: ['Granizo fino', '🌨️'],
  80: ['Chubascos ligeros', '🌦️'],
  81: ['Chubascos', '🌧️'],
  82: ['Chubascos fuertes', '⛈️'],
  85: ['Chubascos de nieve', '🌨️'],
  86: ['Chubascos de nieve fuertes', '❄️'],
  95: ['Tormenta', '⛈️'],
  96: ['Tormenta con granizo', '⛈️'],
  99: ['Tormenta fuerte con granizo', '⛈️'],
};

export function describeWeather(code) {
  return WEATHER[code] ?? ['Clima raro', '🌡️'];
}

function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * "Monterrey, Colombia" → elige el resultado cuyo país o estado coincida con lo que va después de la coma.
 * Sin coma → el primero (el más poblado).
 */
export function pickPlace(results, query) {
  if (!results?.length) return null;
  const [, ...rest] = query.split(',');
  const hint = normalize(rest.join(','));
  if (!hint) return results[0];
  return (
    results.find(
      (r) => normalize(r.country).includes(hint) || normalize(r.admin1).includes(hint),
    ) ?? results[0]
  );
}

const round = (n) => Math.round(Number(n));

export default {
  name: 'clima',
  aliases: ['tiempo', 'weather'],
  description: 'Clima actual de una ciudad',
  usage: '!clima <ciudad> (ej. !clima Monterrey o !clima Monterrey, Colombia)',
  cooldownSeconds: 10,

  async run(ctx) {
    if (!ctx.text) {
      await ctx.reply(`Dime la ciudad, ej. ${ctx.bot.prefix}clima Guadalajara 🌎`);
      return;
    }

    const name = ctx.text.split(',')[0].trim();
    let place;
    let weather;
    try {
      const geo = await ctx.http.get(GEO_URL, {
        query: { name, count: 10, language: 'es', format: 'json' },
      });
      place = pickPlace(geo.results, ctx.text);
      if (!place) {
        await ctx.reply(`No encontré "${name}" 🤔 Revisa cómo se escribe.`);
        return;
      }
      weather = await ctx.http.get(FORECAST_URL, {
        query: {
          latitude: place.latitude,
          longitude: place.longitude,
          current:
            'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone: 'auto',
          forecast_days: 1,
        },
      });
    } catch (err) {
      ctx.log.warn({ status: err.status, err: err.message }, 'Falló la API del clima');
      await ctx.reply('No pude consultar el clima ahorita, intenta en un rato 😅');
      return;
    }

    const now = weather.current;
    const today = weather.daily;
    const [label, emoji] = describeWeather(now.weather_code);
    const where = [place.name, place.admin1, place.country].filter(Boolean).join(', ');

    await ctx.reply(
      [
        `${emoji} *${where}*`,
        `${label}, *${round(now.temperature_2m)}°C* (se siente como ${round(now.apparent_temperature)}°C)`,
        `🔺 Máx ${round(today.temperature_2m_max[0])}°C · 🔻 Mín ${round(today.temperature_2m_min[0])}°C`,
        `💧 Humedad ${round(now.relative_humidity_2m)}% · 🌬️ Viento ${round(now.wind_speed_10m)} km/h`,
        `☔ Probabilidad de lluvia hoy: ${round(today.precipitation_probability_max[0] ?? 0)}%`,
      ].join('\n'),
    );
  },
};
