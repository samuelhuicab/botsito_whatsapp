// Router de IA: prueba los proveedores en orden y cae al siguiente si uno falla.
// - 429 (límite)            → ese proveedor descansa AI_COOLDOWN_ON_429 segundos
// - 401/403 (clave)         → se desactiva hasta reiniciar
// - 404 (modelo no existe)  → se desactiva hasta reiniciar
// - 5xx, timeout, red, vacío → se pasa al siguiente
// Nunca lanza errores: si nada funciona, devuelve un mensaje amable.

import { createLogger } from '../utils/logger.js';

export const NO_PROVIDERS_MESSAGE =
  'La IA no está configurada en este bot 🤖💤 (falta poner una clave en el .env)';
export const ALL_FAILED_MESSAGE =
  'Mis neuronas están ocupadas ahorita 😵‍💫 Intenta de nuevo en un rato.';

/** Tope de caracteres que se mandan por mensaje, para cuidar la cuota. */
export const MAX_INPUT_CHARS = 1500;

/**
 * Adapta Markdown común al formato de WhatsApp: **negritas** → *negritas*, quita títulos "# ".
 * @param {string} text
 */
export function toWhatsApp(text) {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '*$1*')
    .replace(/__(.+?)__/gs, '_$1_')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

/**
 * @param {object} deps
 * @param {import('./providers.js').Provider[]} deps.providers
 * @param {number} deps.maxTokens
 * @param {number} deps.cooldownOn429  segundos
 * @param {() => number} [deps.now]
 * @param {ReturnType<typeof createLogger>} [deps.log]
 */
export function createRouter({
  providers,
  maxTokens,
  cooldownOn429,
  now = () => Date.now(),
  log = createLogger('ai'),
}) {
  const state = new Map(providers.map((p) => [p.name, { blockedUntil: 0, disabled: false }]));

  function isAvailable(provider) {
    const s = state.get(provider.name);
    return !s.disabled && s.blockedUntil <= now();
  }

  function handleError(provider, err) {
    const s = state.get(provider.name);
    const status = err?.status;
    const info = { provider: provider.name, status: status ?? null };

    if (status === 429) {
      s.blockedUntil = now() + cooldownOn429 * 1000;
      log.warn(
        { ...info, seconds: cooldownOn429 },
        `${provider.label} llegó a su límite; descansa`,
      );
    } else if (status === 401 || status === 403) {
      s.disabled = true;
      log.error(info, `Clave inválida de ${provider.label}; desactivado hasta reiniciar`);
    } else if (status === 404) {
      s.disabled = true;
      log.error(
        { ...info, model: provider.model },
        `El modelo no existe en ${provider.label}; cambia el modelo en .env y reinicia`,
      );
    } else {
      // Solo el tipo de error: el mensaje podría incluir partes de la petición.
      log.warn({ ...info, error: err?.name ?? 'Error' }, `${provider.label} falló; probando otro`);
    }
  }

  /**
   * Manda una conversación completa. Devuelve { text, provider } o { text: aviso, provider: null }.
   * @param {{ role: 'system' | 'user' | 'assistant', content: string }[]} messages
   */
  async function complete(messages) {
    if (providers.length === 0) return { text: NO_PROVIDERS_MESSAGE, provider: null };

    const trimmed = messages.map((m) => ({ ...m, content: m.content.slice(0, MAX_INPUT_CHARS) }));

    for (const provider of providers) {
      if (!isAvailable(provider)) continue;
      const started = now();
      try {
        const text = await provider.complete(trimmed, { maxTokens });
        if (!text) {
          log.warn({ provider: provider.name }, `${provider.label} respondió vacío; probando otro`);
          continue;
        }
        log.debug({ provider: provider.name, ms: now() - started }, 'Respuesta de IA');
        return { text: toWhatsApp(text), provider: provider.name };
      } catch (err) {
        handleError(provider, err);
      }
    }

    log.warn('Ningún proveedor de IA respondió');
    return { text: ALL_FAILED_MESSAGE, provider: null };
  }

  return {
    complete,

    /**
     * Pregunta simple (lo que usan los comandos como ctx.ai.ask).
     * @param {string} prompt
     * @param {{ system?: string }} [opts]
     * @returns {Promise<string>}
     */
    async ask(prompt, { system } = {}) {
      const messages = [];
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: String(prompt) });
      return (await complete(messages)).text;
    },

    /** ¿Hay al menos un proveedor configurado? */
    get configured() {
      return providers.length > 0;
    },

    /** Estado de cada proveedor (para logs o un futuro comando de admin). */
    status() {
      return providers.map((p) => ({
        name: p.name,
        model: p.model,
        disabled: state.get(p.name).disabled,
        blockedFor: Math.max(0, Math.ceil((state.get(p.name).blockedUntil - now()) / 1000)),
      }));
    },
  };
}
