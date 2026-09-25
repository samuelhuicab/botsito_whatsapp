// Arranque: config → IA → comandos → WhatsApp.

import { fileURLToPath } from 'node:url';
import { createChat } from './ai/chat.js';
import { loadPersonality } from './ai/prompts.js';
import { buildProviders } from './ai/providers.js';
import { createRouter } from './ai/router.js';
import { config } from './config.js';
import { createCooldowns } from './core/cooldown.js';
import { loadCommands } from './core/loader.js';
import { createMessageHandler } from './handlers/message.js';
import { createHttp } from './utils/http.js';
import { createLogger, logger } from './utils/logger.js';
import { createWhatsAppClient } from './whatsapp/client.js';

const projectPath = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

// IA: solo los proveedores con clave. Sin ninguno, el bot funciona igual pero sin IA.
const providers = buildProviders(config.ai);
const ai = createRouter({
  providers,
  maxTokens: config.ai.maxTokens,
  cooldownOn429: config.ai.cooldownOn429,
});
if (providers.length > 0) {
  logger.info(
    { providers: providers.map((p) => `${p.name} (${p.model})`) },
    'IA lista, en este orden',
  );
} else {
  logger.warn('Sin claves de IA en .env: el bot funcionará sin IA');
}

// Personalidad: private/prompt.js si existe, si no la pública.
const { personality, randomReplies, source } = await loadPersonality({
  file: projectPath('private/prompt.js'),
  botName: config.bot.name,
  log: createLogger('ai'),
});
logger.info(
  { randomReplies: randomReplies.length },
  source === 'private'
    ? 'Personalidad: privada (private/prompt.js)'
    : 'Personalidad: pública (crea private/prompt.js para personalizarla)',
);

let registry;
try {
  registry = await loadCommands({
    publicDir: projectPath('commands'),
    privateDir: projectPath('private/commands'),
    log: createLogger('loader'),
  });
} catch (err) {
  logger.fatal(err.message);
  process.exit(1);
}

const handleMessage = createMessageHandler({
  registry,
  config,
  cooldowns: createCooldowns(),
  services: {
    http: createHttp({ timeoutSeconds: config.http.timeout }),
    ai,
    chat:
      providers.length > 0
        ? createChat({
            router: ai,
            historySize: config.ai.historySize,
            botName: config.bot.name,
            personality,
            randomReplies,
          })
        : undefined,
  },
});

const whatsapp = createWhatsAppClient({ dataPath: projectPath('data') });

whatsapp.on('message', (message) => {
  handleMessage(message).catch((err) => {
    logger.error({ err: err.message }, 'Error no controlado al procesar un mensaje');
  });
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Apagando…');
  try {
    await whatsapp.stop();
  } catch (err) {
    logger.warn({ err: err.message }, 'Error al cerrar WhatsApp');
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await whatsapp.start();
} catch (err) {
  logger.fatal({ err: err.message }, 'No se pudo iniciar WhatsApp');
  process.exit(1);
}
