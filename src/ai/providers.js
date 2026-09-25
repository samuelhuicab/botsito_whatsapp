// Proveedores de IA gratis. Todos hablan el formato de OpenAI, así que se usa un solo SDK.
// Solo se activan los que tienen clave en .env, en el orden de AI_PROVIDER_ORDER.

import OpenAI from 'openai';

/** Timeout por llamada a un proveedor (ms). */
export const AI_TIMEOUT_MS = 20_000;

/** Datos fijos de cada proveedor. `extra` son parámetros adicionales para la petición. */
export const PROVIDER_DEFINITIONS = {
  groq: {
    label: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
  },
  gemini: {
    label: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  },
  openrouter: {
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    headers: { 'X-Title': 'Botsito' },
  },
};

function defaultCreateClient({ apiKey, baseURL, headers }) {
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: AI_TIMEOUT_MS,
    maxRetries: 0, // el router se encarga de reintentar con otro proveedor
    defaultHeaders: headers,
  });
}

/**
 * @typedef {object} Provider
 * @property {string} name     id interno (groq, gemini…)
 * @property {string} label    nombre bonito para logs
 * @property {string} model
 * @property {(messages: {role: string, content: string}[], opts: { maxTokens: number }) => Promise<string>} complete
 */

/**
 * @param {object} aiConfig  config.ai
 * @param {{ createClient?: typeof defaultCreateClient }} [options]
 * @returns {Provider[]}
 */
export function buildProviders(aiConfig, { createClient = defaultCreateClient } = {}) {
  const providers = [];
  for (const name of aiConfig.providerOrder) {
    const definition = PROVIDER_DEFINITIONS[name];
    const settings = aiConfig.providers[name];
    if (!definition || !settings?.apiKey) continue;

    const client = createClient({
      apiKey: settings.apiKey,
      baseURL: definition.baseURL,
      headers: definition.headers,
    });

    providers.push({
      name,
      label: definition.label,
      model: settings.model,
      async complete(messages, { maxTokens }) {
        const response = await client.chat.completions.create({
          model: settings.model,
          messages,
          max_tokens: maxTokens,
          ...definition.extra,
        });
        return response.choices?.[0]?.message?.content?.trim() ?? '';
      },
    });
  }
  return providers;
}
