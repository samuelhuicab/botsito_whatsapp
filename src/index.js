// Arranque: config → IA → comandos → WhatsApp.
// Por ahora solo conecta WhatsApp; IA y comandos se agregan en los siguientes pasos.

import { logger } from './utils/logger.js';
import { createWhatsAppClient } from './whatsapp/client.js';

const whatsapp = createWhatsAppClient();

whatsapp.on('message', (message) => {
  // Temporal hasta tener el handler: solo metadatos, nunca el contenido completo.
  logger.debug(
    {
      chat: message.chat.id,
      isGroup: message.chat.isGroup,
      mentionsBot: message.mentionsBot,
      length: message.body.length,
    },
    'Mensaje recibido',
  );
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
