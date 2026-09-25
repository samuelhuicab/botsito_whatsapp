import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProviders } from '../src/ai/providers.js';
import {
  ALL_FAILED_MESSAGE,
  MAX_INPUT_CHARS,
  NO_PROVIDERS_MESSAGE,
  createRouter,
  toWhatsApp,
} from '../src/ai/router.js';

const silentLog = { debug() {}, info() {}, warn() {}, error() {} };

function httpError(status) {
  return Object.assign(new Error(`status ${status}`), { status });
}

/**
 * Proveedor falso. `behaviors` es una lista de lo que hace en cada llamada:
 * un texto → responde eso; un Error → lo lanza. La última se repite.
 */
function fakeProvider(name, ...behaviors) {
  const provider = {
    name,
    label: name,
    model: `${name}-model`,
    calls: 0,
    lastMessages: null,
    complete(messages) {
      provider.lastMessages = messages;
      const behavior = behaviors[Math.min(provider.calls, behaviors.length - 1)];
      provider.calls++;
      return behavior instanceof Error ? Promise.reject(behavior) : Promise.resolve(behavior);
    },
  };
  return provider;
}

function makeRouter(providers, clock = { time: 0 }) {
  return createRouter({
    providers,
    maxTokens: 300,
    cooldownOn429: 60,
    now: () => clock.time,
    log: silentLog,
  });
}

test('usa el primer proveedor si responde', async () => {
  const a = fakeProvider('a', 'hola desde a');
  const b = fakeProvider('b', 'hola desde b');
  const result = await makeRouter([a, b]).complete([{ role: 'user', content: 'hola' }]);
  assert.deepEqual(result, { text: 'hola desde a', provider: 'a' });
  assert.equal(b.calls, 0);
});

test('429 → pasa al siguiente y el proveedor descansa el cooldown', async () => {
  const clock = { time: 0 };
  const a = fakeProvider('a', httpError(429), 'a ya volvió');
  const b = fakeProvider('b', 'respuesta b');
  const router = makeRouter([a, b], clock);

  assert.equal(await router.ask('hola'), 'respuesta b');
  assert.equal(await router.ask('hola'), 'respuesta b');
  assert.equal(a.calls, 1, 'no se vuelve a llamar mientras descansa');
  assert.equal(router.status()[0].blockedFor, 60);

  clock.time += 60_000;
  assert.equal(await router.ask('hola'), 'a ya volvió');
});

test('5xx o timeout → pasa al siguiente sin bloquear', async () => {
  const timeout = Object.assign(new Error('Request timed out.'), {
    name: 'APIConnectionTimeoutError',
  });
  const a = fakeProvider('a', httpError(503), timeout, 'ok a');
  const b = fakeProvider('b', 'ok b');
  const router = makeRouter([a, b]);

  assert.equal(await router.ask('1'), 'ok b');
  assert.equal(await router.ask('2'), 'ok b');
  assert.equal(await router.ask('3'), 'ok a');
  assert.equal(a.calls, 3);
});

test('401/403 → se desactiva hasta reiniciar', async () => {
  const clock = { time: 0 };
  const a = fakeProvider('a', httpError(401), 'nunca');
  const b = fakeProvider('b', httpError(403), 'nunca');
  const c = fakeProvider('c', 'ok c');
  const router = makeRouter([a, b, c], clock);

  assert.equal(await router.ask('hola'), 'ok c');
  clock.time += 24 * 60 * 60 * 1000;
  assert.equal(await router.ask('hola'), 'ok c');
  assert.equal(a.calls, 1);
  assert.equal(b.calls, 1);
  assert.deepEqual(
    router.status().map((s) => s.disabled),
    [true, true, false],
  );
});

test('404 (modelo que ya no existe) → se desactiva', async () => {
  const a = fakeProvider('a', httpError(404));
  const b = fakeProvider('b', 'ok b');
  const router = makeRouter([a, b]);
  await router.ask('1');
  await router.ask('2');
  assert.equal(a.calls, 1);
});

test('respuesta vacía → pasa al siguiente', async () => {
  const a = fakeProvider('a', '');
  const b = fakeProvider('b', 'ok b');
  assert.equal(await makeRouter([a, b]).ask('hola'), 'ok b');
});

test('si todos fallan → mensaje amable, sin lanzar error', async () => {
  const router = makeRouter([
    fakeProvider('a', httpError(500)),
    fakeProvider('b', new TypeError('fetch failed')),
  ]);
  assert.deepEqual(await router.complete([{ role: 'user', content: 'hola' }]), {
    text: ALL_FAILED_MESSAGE,
    provider: null,
  });
});

test('sin proveedores → aviso de que la IA no está configurada', async () => {
  const router = makeRouter([]);
  assert.equal(router.configured, false);
  assert.equal(await router.ask('hola'), NO_PROVIDERS_MESSAGE);
});

test('ask arma system + user y recorta mensajes muy largos', async () => {
  const a = fakeProvider('a', 'ok');
  await makeRouter([a]).ask('x'.repeat(5000), { system: 'sé breve' });
  assert.equal(a.lastMessages.length, 2);
  assert.deepEqual(a.lastMessages[0], { role: 'system', content: 'sé breve' });
  assert.equal(a.lastMessages[1].content.length, MAX_INPUT_CHARS);
});

test('toWhatsApp convierte Markdown al formato de WhatsApp', async () => {
  assert.equal(toWhatsApp('esto es **muy** __chido__'), 'esto es *muy* _chido_');
  assert.equal(toWhatsApp('## Título\ntexto *ya bien*'), 'Título\ntexto *ya bien*');
  const a = fakeProvider('a', '**hola**');
  assert.equal(await makeRouter([a]).ask('x'), '*hola*');
});

test('buildProviders respeta el orden y omite los que no tienen clave', async () => {
  const created = [];
  const providers = buildProviders(
    {
      providerOrder: ['openrouter', 'groq', 'gemini'],
      providers: {
        groq: { apiKey: 'g', model: 'm-groq' },
        gemini: { apiKey: '', model: 'm-gemini' },
        openrouter: { apiKey: 'o', model: 'm-or' },
      },
    },
    {
      createClient: (opts) => {
        created.push(opts.baseURL);
        return {
          chat: {
            completions: {
              create: (req) =>
                Promise.resolve({
                  choices: [{ message: { content: `  ${req.model}:${req.max_tokens}  ` } }],
                }),
            },
          },
        };
      },
    },
  );

  assert.deepEqual(
    providers.map((p) => p.name),
    ['openrouter', 'groq'],
  );
  assert.match(created[0], /openrouter/);
  assert.equal(await providers[1].complete([], { maxTokens: 300 }), 'm-groq:300');
});
