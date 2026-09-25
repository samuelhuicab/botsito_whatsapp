import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChat } from '../src/ai/chat.js';
import { ALL_FAILED_MESSAGE } from '../src/ai/router.js';

/** Router falso que guarda lo que recibe y responde en orden. */
function fakeRouter(...answers) {
  const calls = [];
  return {
    calls,
    complete(messages) {
      calls.push(messages);
      const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
      return Promise.resolve(answer);
    },
  };
}

function fakeMessage({ chatId = 'a@c.us', isGroup = false, name = 'Ana' } = {}) {
  const replies = [];
  return {
    replies,
    typingCalls: 0,
    chat: { id: chatId, isGroup, name: null },
    sender: { id: 'a@c.us', phone: '5215511111111', name },
    reply: (text) => Promise.resolve(replies.push(text)),
    typing() {
      this.typingCalls++;
      return Promise.resolve();
    },
  };
}

const ok = (text) => ({ text, provider: 'fake' });

test('responde con la IA y manda system prompt con el nombre del bot', async () => {
  const router = fakeRouter(ok('¡Qué onda!'));
  const chat = createChat({ router, historySize: 6, botName: 'Boomi' });
  const msg = fakeMessage();

  await chat(msg, 'hola');

  assert.deepEqual(msg.replies, ['¡Qué onda!']);
  assert.equal(msg.typingCalls, 1);
  const [system, user] = router.calls[0];
  assert.equal(system.role, 'system');
  assert.match(system.content, /Boomi/);
  assert.deepEqual(user, { role: 'user', content: 'hola' });
});

test('usa la personalidad que le pasen (la privada)', async () => {
  const router = fakeRouter(ok('¡Arr!'));
  const chat = createChat({
    router,
    historySize: 6,
    botName: 'Boomi',
    personality: 'Eres un pirata.',
  });
  await chat(fakeMessage(), 'hola');
  assert.deepEqual(router.calls[0][0], { role: 'system', content: 'Eres un pirata.' });
});

test('respuesta al azar: si toca, responde solo eso sin usar IA', async () => {
  const router = fakeRouter(ok('respuesta IA'));
  const rolls = [0.01, 0.5];
  const chat = createChat({
    router,
    historySize: 6,
    botName: 'Boomi',
    randomReplies: [{ text: 'the game', chance: 0.07 }],
    random: () => rolls.shift(),
  });

  const lucky = fakeMessage();
  await chat(lucky, 'hola');
  assert.deepEqual(lucky.replies, ['the game']);
  assert.equal(router.calls.length, 0);

  const normal = fakeMessage();
  await chat(normal, 'hola');
  assert.deepEqual(normal.replies, ['respuesta IA']);
});

test('recuerda la conversación y la recorta a historySize', async () => {
  const router = fakeRouter(ok('r1'), ok('r2'), ok('r3'));
  const chat = createChat({ router, historySize: 2, botName: 'Boomi' });

  await chat(fakeMessage(), 'm1');
  await chat(fakeMessage(), 'm2');
  assert.deepEqual(router.calls[1].slice(1), [
    { role: 'user', content: 'm1' },
    { role: 'assistant', content: 'r1' },
    { role: 'user', content: 'm2' },
  ]);

  await chat(fakeMessage(), 'm3');
  assert.deepEqual(router.calls[2].slice(1), [
    { role: 'user', content: 'm2' },
    { role: 'assistant', content: 'r2' },
    { role: 'user', content: 'm3' },
  ]);
});

test('cada chat tiene su propio historial', async () => {
  const router = fakeRouter(ok('r'));
  const chat = createChat({ router, historySize: 6, botName: 'Boomi' });
  await chat(fakeMessage({ chatId: 'uno' }), 'hola desde uno');
  await chat(fakeMessage({ chatId: 'dos' }), 'hola desde dos');
  assert.equal(router.calls[1].length, 2, 'solo system + user, sin historial de "uno"');
});

test('en grupos antepone el nombre de quien habla', async () => {
  const router = fakeRouter(ok('r'));
  const chat = createChat({ router, historySize: 6, botName: 'Boomi' });
  await chat(fakeMessage({ chatId: 'g@g.us', isGroup: true, name: 'Luis' }), '¿quién eres?');
  const messages = router.calls[0];
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'Luis: ¿quién eres?' });
  assert.match(messages[0].content, /grupo/);
});

test('si la IA falla, responde el aviso pero no lo guarda en el historial', async () => {
  const router = fakeRouter({ text: ALL_FAILED_MESSAGE, provider: null }, ok('ya'));
  const chat = createChat({ router, historySize: 6, botName: 'Boomi' });
  const msg = fakeMessage();

  await chat(msg, 'hola');
  await chat(fakeMessage(), 'otra vez');

  assert.deepEqual(msg.replies, [ALL_FAILED_MESSAGE]);
  assert.equal(router.calls[1].length, 2, 'sin el intento fallido');
});

test('solo el nombre del bot → saludo sin gastar IA', async () => {
  const router = fakeRouter(ok('nunca'));
  const chat = createChat({ router, historySize: 6, botName: 'Boomi' });
  const msg = fakeMessage();
  await chat(msg, '  ');
  assert.equal(router.calls.length, 0);
  assert.match(msg.replies[0], /Boomi/);
});
