// Lee y valida la configuración desde .env.
// loadConfig() es pura (recibe el env) para poder probarla sin tocar process.env.

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const KNOWN_PROVIDERS = ['groq', 'gemini', 'openrouter'];
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/**
 * Lee un entero positivo (o cero) del env; usa el default si viene vacío.
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 * @param {number} fallback
 * @param {string[]} errors
 */
function readInt(env, key, fallback, errors) {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${key} debe ser un número entero >= 0 (llegó "${raw}")`);
    return fallback;
  }
  return value;
}

/**
 * Lee un texto del env; usa el default si viene vacío.
 * @param {Record<string, string | undefined>} env
 * @param {string} key
 * @param {string} fallback
 */
function readString(env, key, fallback = '') {
  const raw = env[key]?.trim();
  return raw ? raw : fallback;
}

/**
 * Arma y valida la configuración. Lanza un error con todos los problemas juntos.
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = process.env) {
  const errors = [];

  const ownerNumber = readString(env, 'OWNER_NUMBER');
  if (ownerNumber && !/^\d{8,15}$/.test(ownerNumber)) {
    errors.push('OWNER_NUMBER debe ser solo dígitos con código de país (ej. 5215512345678)');
  }

  const commandPrefix = readString(env, 'COMMAND_PREFIX', '!');
  if (/\s/.test(commandPrefix)) {
    errors.push('COMMAND_PREFIX no puede tener espacios');
  }

  const providerOrder = readString(env, 'AI_PROVIDER_ORDER', KNOWN_PROVIDERS.join(','))
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const unknown = providerOrder.filter((name) => !KNOWN_PROVIDERS.includes(name));
  if (unknown.length > 0) {
    errors.push(
      `AI_PROVIDER_ORDER tiene proveedores desconocidos: ${unknown.join(', ')} ` +
        `(válidos: ${KNOWN_PROVIDERS.join(', ')})`,
    );
  }

  const logLevel = readString(env, 'LOG_LEVEL', 'info').toLowerCase();
  if (!LOG_LEVELS.includes(logLevel)) {
    errors.push(`LOG_LEVEL debe ser uno de: ${LOG_LEVELS.join(', ')}`);
  }

  const config = {
    bot: {
      name: readString(env, 'BOT_NAME', 'botsito'),
      trigger: readString(env, 'BOT_TRIGGER', 'bot').toLowerCase(),
      commandPrefix,
      ownerNumber,
    },
    ai: {
      userCooldown: readInt(env, 'AI_USER_COOLDOWN', 10, errors),
      historySize: readInt(env, 'AI_HISTORY_SIZE', 6, errors),
      maxTokens: readInt(env, 'AI_MAX_TOKENS', 300, errors),
      cooldownOn429: readInt(env, 'AI_COOLDOWN_ON_429', 60, errors),
      providerOrder,
      providers: {
        groq: {
          apiKey: readString(env, 'GROQ_API_KEY'),
          model: readString(env, 'GROQ_MODEL', 'openai/gpt-oss-120b'),
        },
        gemini: {
          apiKey: readString(env, 'GEMINI_API_KEY'),
          model: readString(env, 'GEMINI_MODEL', 'gemini-flash-lite-latest'),
        },
        openrouter: {
          apiKey: readString(env, 'OPENROUTER_API_KEY'),
          model: readString(env, 'OPENROUTER_MODEL', 'openrouter/free'),
        },
      },
    },
    http: {
      timeout: readInt(env, 'HTTP_TIMEOUT', 10, errors),
    },
    logLevel,
  };

  if (errors.length > 0) {
    throw new Error(`Configuración inválida en .env:\n  - ${errors.join('\n  - ')}`);
  }

  return deepFreeze(config);
}

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

export const config = loadConfig();
