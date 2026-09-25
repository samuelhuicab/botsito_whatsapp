// Logger central (pino). Cada módulo pide su hijo con createLogger('nombre').
// Recordatorio: nunca loggear claves ni el contenido completo de mensajes.

import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.logLevel,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * @param {string} name nombre del módulo o comando
 */
export function createLogger(name) {
  return logger.child({ module: name });
}
