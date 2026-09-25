// Adaptador de WhatsApp: ÚNICO lugar que conoce whatsapp-web.js.
// Emite mensajes normalizados para que el resto del bot no dependa de la librería
// (así se puede cambiar a Baileys reescribiendo solo este archivo).

import { EventEmitter } from 'node:events';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import wwebjs from 'whatsapp-web.js';
import { createLogger } from '../utils/logger.js';

const { Client, LocalAuth } = wwebjs;
const log = createLogger('whatsapp');

const DATA_PATH = path.resolve('data');

/**
 * @typedef {object} NormalizedMessage
 * @property {string} id
 * @property {string} body
 * @property {number} timestamp            segundos Unix
 * @property {{ id: string, isGroup: boolean, name: string | null }} chat
 * @property {{ id: string, phone: string | null, name: string | null }} sender
 * @property {boolean} mentionsBot
 * @property {() => Promise<void>} resolve  llena chat.name y sender.phone (hace llamadas extra; usar solo si se va a responder)
 * @property {(text: string) => Promise<void>} reply
 * @property {(emoji: string) => Promise<void>} react
 */

/** Saca los dígitos de un id tipo "5215512345678@c.us"; null si no es un número de teléfono. */
export function phoneFromId(id) {
  if (!id || !id.endsWith('@c.us')) return null;
  return id.split('@')[0].split(':')[0];
}

/** ¿Alguno de los ids mencionados es del bot? */
export function isBotMentioned(mentionedIds, botIds) {
  return (mentionedIds ?? []).some((id) => botIds.has(id));
}

/**
 * Crea el adaptador. Eventos:
 * - 'qr'           (string)            código QR (ya se imprime en la terminal)
 * - 'ready'        ({ id, name })
 * - 'disconnected' (reason)
 * - 'message'      (NormalizedMessage)
 */
export function createWhatsAppClient() {
  const events = new EventEmitter();
  /** ids con los que el bot puede aparecer en menciones (@c.us y @lid) */
  const botIds = new Set();
  /** cache lid → teléfono, para no preguntarle a WhatsApp cada vez */
  const phoneCache = new Map();

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: DATA_PATH }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    log.info('Escanea el QR con WhatsApp → Dispositivos vinculados');
    qrcode.generate(qr, { small: true });
    events.emit('qr', qr);
  });

  client.on('authenticated', () => log.info('Sesión autenticada'));

  client.on('auth_failure', (reason) => {
    log.error({ reason }, 'Falló la autenticación; borra la carpeta data/ y vuelve a escanear');
  });

  client.on('ready', async () => {
    const wid = client.info.wid._serialized;
    botIds.add(wid);
    try {
      const [ids] = await client.getContactLidAndPhone([wid]);
      if (ids?.lid) botIds.add(ids.lid);
    } catch (err) {
      log.warn(
        { err: err.message },
        'No se pudo obtener el lid del bot; las menciones @ podrían no detectarse',
      );
    }
    log.info({ phone: phoneFromId(wid) }, 'WhatsApp listo ✅');
    events.emit('ready', { id: wid, name: client.info.pushname ?? null });
  });

  client.on('disconnected', (reason) => {
    log.warn({ reason }, 'WhatsApp se desconectó');
    events.emit('disconnected', reason);
  });

  client.on('message', (msg) => {
    if (msg.fromMe || msg.isStatus || msg.from === 'status@broadcast') return;
    try {
      events.emit('message', normalize(msg));
    } catch (err) {
      log.error({ err: err.message }, 'No se pudo normalizar un mensaje');
    }
  });

  /** Resuelve el teléfono de un id (@c.us directo, @lid preguntándole a WhatsApp). */
  async function resolvePhone(id) {
    const direct = phoneFromId(id);
    if (direct) return direct;
    if (phoneCache.has(id)) return phoneCache.get(id);
    try {
      const [ids] = await client.getContactLidAndPhone([id]);
      const phone = phoneFromId(ids?.pn);
      phoneCache.set(id, phone);
      return phone;
    } catch {
      return null;
    }
  }

  /** @returns {NormalizedMessage} */
  function normalize(msg) {
    const chatId = msg.from;
    const isGroup = chatId.endsWith('@g.us');
    const senderId = isGroup ? msg.author : msg.from;

    const message = {
      id: msg.id._serialized,
      body: msg.body ?? '',
      timestamp: msg.timestamp,
      chat: { id: chatId, isGroup, name: null },
      sender: {
        id: senderId,
        phone: phoneFromId(senderId),
        // notifyName es el nombre que la persona puso en su WhatsApp (no es API pública, por eso el fallback)
        name: msg._data?.notifyName ?? null,
      },
      mentionsBot: isBotMentioned(msg.mentionedIds, botIds),

      async resolve() {
        const [phone, chat] = await Promise.all([
          message.sender.phone ?? resolvePhone(senderId),
          isGroup ? msg.getChat().catch(() => null) : null,
        ]);
        message.sender.phone = phone;
        message.chat.name = isGroup ? (chat?.name ?? null) : message.sender.name;
      },

      async reply(text) {
        await msg.reply(text);
      },

      async react(emoji) {
        await msg.react(emoji);
      },
    };
    return message;
  }

  return {
    on: events.on.bind(events),
    off: events.off.bind(events),

    async start() {
      log.info('Iniciando WhatsApp (la primera vez tarda un poco)…');
      await client.initialize();
    },

    async stop() {
      await client.destroy();
    },
  };
}
