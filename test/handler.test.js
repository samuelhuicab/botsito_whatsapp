import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createCooldowns } from '../src/core/cooldown.js';
import {
  createMessageHandler,
  parseCommand,
  samePhone,
  stripTrigger,
} from '../src/handlers/message.js';

const config = loadConfig({ OWNER_NUMBER: '5215500000000', LOG_LEVEL: 'silent' });

/** Mensaje normalizado falso que guarda las respuestas. */
function fakeMessage({ body, phone = '5215511111111', isGroup = false, mentionsBot = false }) {
  const replies = [];
  const reactions = [];
  return {
    replies,
    reactions,
    body,
    mentionsBot,
    chat: { id: isGroup ? 'g@g.us' : `${phone}@c.us`, isGroup, name: null },
    sender: { id: `${phone}@c.us`, phone, name: 'Ana' },
    resolve: async () => {},
    reply: (text) => Promise.resolve(replies.push(text)),
    react: (emoji) => Promise.resolve(reactions.push(emoji)),
  };
}

function registryOf(...commands) {
  const list = commands.map((c) => ({ aliases: [], ...c }));
  return {
    list,
    find: (name) => list.find((c) => c.name === name || c.aliases.includes(name)),
  };
}

test('parseCommand separa nombre, args y texto', () => {
  assert.deepEqual(parseCommand('!Rank  juan 2', '!'), {
    name: 'rank',
    args: ['juan', '2'],
    text: 'juan 2',
  });
  assert.deepEqual(parseCommand('!ping', '!'), { name: 'ping', args: [], text: '' });
  assert.equal(parseCommand('hola', '!'), null);
  assert.equal(parseCommand('!', '!'), null);
  assert.equal(parseCommand('!   ', '!'), null);
});

test('stripTrigger reconoce la palabra completa', () => {
  assert.equal(stripTrigger('bot ¿qué onda?', 'bot'), '¿qué onda?');
  assert.equal(stripTrigger('Bot, cuéntame un chiste', 'bot'), 'cuéntame un chiste');
  assert.equal(stripTrigger('bot', 'bot'), '');
  assert.equal(stripTrigger('botella de agua', 'bot'), null);
  assert.equal(stripTrigger('hola bot', 'bot'), null);
});

test('samePhone tolera el 1 extra de México', () => {
  assert.equal(samePhone('5215512345678', '525512345678'), true);
  assert.equal(samePhone('525512345678', '5215512345678'), true);
  assert.equal(samePhone('525512345678', '525512345678'), true);
  assert.equal(samePhone('525512345678', '525512345679'), false);
  assert.equal(samePhone('14155550123', '14155550123'), true);
  assert.equal(samePhone(null, '525512345678'), false);
  assert.equal(samePhone('525512345678', ''), false);
});

test('ejecuta el comando con args y ctx', async () => {
  let received;
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf({ name: 'eco', run: (ctx) => Promise.resolve((received = ctx)) }),
  });
  await handler(fakeMessage({ body: '!eco hola mundo' }));

  assert.deepEqual(received.args, ['hola', 'mundo']);
  assert.equal(received.text, 'hola mundo');
  assert.equal(received.sender.name, 'Ana');
  assert.equal(received.isOwner, false);
  assert.equal(received.bot.prefix, '!');
});

test('comando desconocido o mensaje normal → no responde', async () => {
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf(),
  });
  const msg = fakeMessage({ body: '!noexiste' });
  await handler(msg);
  const normal = fakeMessage({ body: 'hola a todos' });
  await handler(normal);
  assert.equal(msg.replies.length + normal.replies.length, 0);
});

test('ownerOnly y groupOnly se validan', async () => {
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf(
      { name: 'secreto', ownerOnly: true, run: (ctx) => ctx.reply('ok') },
      { name: 'grupal', groupOnly: true, run: (ctx) => ctx.reply('ok') },
    ),
  });

  const stranger = fakeMessage({ body: '!secreto' });
  await handler(stranger);
  assert.match(stranger.replies[0], /dueño/);

  const owner = fakeMessage({ body: '!secreto', phone: '5215500000000' });
  await handler(owner);
  assert.deepEqual(owner.replies, ['ok']);

  const privateChat = fakeMessage({ body: '!grupal' });
  await handler(privateChat);
  assert.match(privateChat.replies[0], /grupos/);

  const group = fakeMessage({ body: '!grupal', isGroup: true });
  await handler(group);
  assert.deepEqual(group.replies, ['ok']);
});

test('cooldown por usuario; el dueño no tiene cooldown', async () => {
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf({ name: 'ping', cooldownSeconds: 30, run: (ctx) => ctx.reply('pong') }),
  });

  const first = fakeMessage({ body: '!ping' });
  await handler(first);
  const second = fakeMessage({ body: '!ping' });
  await handler(second);
  const otherUser = fakeMessage({ body: '!ping', phone: '5215522222222' });
  await handler(otherUser);

  assert.deepEqual(first.replies, ['pong']);
  assert.match(second.replies[0], /espera 30s/);
  assert.deepEqual(otherUser.replies, ['pong']);

  for (let i = 0; i < 2; i++) {
    const owner = fakeMessage({ body: '!ping', phone: '5215500000000' });
    await handler(owner);
    assert.deepEqual(owner.replies, ['pong']);
  }
});

test('si el comando falla, responde amable y no revienta', async () => {
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf({
      name: 'roto',
      run: () => Promise.reject(new Error('boom')),
    }),
  });
  const msg = fakeMessage({ body: '!roto' });
  await handler(msg);
  assert.deepEqual(msg.replies, ['Algo salió mal 😅']);
});

test('trigger o mención → modo plática (si está configurado)', async () => {
  const calls = [];
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf(),
    services: { chat: (message, text) => Promise.resolve(calls.push(text)) },
  });

  await handler(fakeMessage({ body: 'bot ¿qué onda?' }));
  await handler(fakeMessage({ body: '@botsito hola', mentionsBot: true, phone: '5215533333333' }));
  await handler(fakeMessage({ body: 'la botella', phone: '5215544444444' }));

  assert.deepEqual(calls, ['¿qué onda?', '@botsito hola']);
});

test('sin modo plática configurado, el trigger no hace nada', async () => {
  const handler = createMessageHandler({
    config,
    cooldowns: createCooldowns(),
    registry: registryOf(),
  });
  const msg = fakeMessage({ body: 'bot hola' });
  await handler(msg);
  assert.equal(msg.replies.length + msg.reactions.length, 0);
});
