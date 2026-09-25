import { test } from 'node:test';
import assert from 'node:assert/strict';
import calc, { evaluate, formatResult } from '../commands/calc.js';
import { parseExchangeArgs } from '../commands/cambio.js';
import { describeWeather, pickPlace } from '../commands/clima.js';
import elige, { parseOptions } from '../commands/elige.js';
import { formatDuration, parseDuration } from '../commands/recuerda.js';

function fakeCtx(text) {
  const replies = [];
  return {
    replies,
    text,
    args: text ? text.split(/\s+/) : [],
    bot: { prefix: '!', name: 'Boomi' },
    reply: (t) => Promise.resolve(replies.push(t)),
  };
}

// ── calc ──────────────────────────────────────────────────────────────
test('calc: operaciones básicas y precedencia', () => {
  assert.equal(evaluate('2+3*4'), 14);
  assert.equal(evaluate('(2+3)*4'), 20);
  assert.equal(evaluate('2*(3+4)^2'), 98);
  assert.equal(evaluate('2^3^2'), 512);
  assert.equal(evaluate('-3 + 5'), 2);
  assert.equal(evaluate('10 / 4'), 2.5);
  assert.equal(evaluate('3 x 4'), 12);
  assert.equal(evaluate('3 × 4 ÷ 2'), 6);
  assert.equal(evaluate('1,5 * 2'), 3);
});

test('calc: porcentajes, funciones y constantes', () => {
  assert.equal(evaluate('850*15%'), 127.5);
  assert.equal(evaluate('raiz(144)'), 12);
  assert.equal(evaluate('√(81)'), 9);
  assert.equal(evaluate('abs(-7)'), 7);
  assert.equal(evaluate('log(1000)'), 3);
  assert.ok(Math.abs(evaluate('pi') - Math.PI) < 1e-12);
});

test('calc: errores con mensaje amable, sin ejecutar código', () => {
  assert.throws(() => evaluate('1/0'), /dividir entre cero/);
  assert.throws(() => evaluate('(2+3'), /paréntesis/);
  assert.throws(() => evaluate('2+'), /falta algo/);
  assert.throws(() => evaluate('raiz(-4)'), /negativos/);
  assert.throws(() => evaluate('process.exit()'), /No entiendo/);
  assert.throws(() => evaluate('alert(1)'), /No entiendo/);
  assert.throws(() => evaluate('9^9^9'), /demasiado grande/);
  assert.throws(() => evaluate('1'.repeat(300)), /muy larga/);
});

test('calc: formato del resultado', () => {
  assert.equal(formatResult(1234567), '1,234,567');
  assert.equal(formatResult(0.1 + 0.2), '0.3');
});

test('calc: responde el resultado o el error', async () => {
  const ok = fakeCtx('2+2');
  await calc.run(ok);
  assert.deepEqual(ok.replies, ['🧮 2+2 = *4*']);
  const bad = fakeCtx('2+');
  await calc.run(bad);
  assert.match(bad.replies[0], /falta algo/);
});

// ── cambio ────────────────────────────────────────────────────────────
test('cambio: interpreta cantidad y monedas', () => {
  assert.deepEqual(parseExchangeArgs([]), { amount: 1, from: 'USD', to: 'MXN' });
  assert.deepEqual(parseExchangeArgs(['100']), { amount: 100, from: 'USD', to: 'MXN' });
  assert.deepEqual(parseExchangeArgs(['50', 'eur']), { amount: 50, from: 'EUR', to: 'MXN' });
  assert.deepEqual(parseExchangeArgs(['20', 'usd', 'a', 'cop']), {
    amount: 20,
    from: 'USD',
    to: 'COP',
  });
  assert.deepEqual(parseExchangeArgs(['$1,000', 'dólares', 'euros']), {
    amount: 1000,
    from: 'USD',
    to: 'EUR',
  });
  assert.deepEqual(parseExchangeArgs(['pesos']), { amount: 1, from: 'MXN', to: 'USD' });
});

test('cambio: errores claros', () => {
  assert.match(parseExchangeArgs(['-5']).error, /mayor a 0/);
  assert.match(parseExchangeArgs(['100', 'bitcoins']).error, /bitcoins/);
  assert.match(parseExchangeArgs(['usd', 'mxn', 'eur']).error, /Solo dime/);
});

// ── clima ─────────────────────────────────────────────────────────────
test('clima: elige la ciudad según el país o estado después de la coma', () => {
  const results = [
    { name: 'Monterrey', admin1: 'Nuevo León', country: 'México' },
    { name: 'Monterrey', admin1: 'Casanare', country: 'Colombia' },
  ];
  assert.equal(pickPlace(results, 'Monterrey').country, 'México');
  assert.equal(pickPlace(results, 'Monterrey, colombia').country, 'Colombia');
  assert.equal(pickPlace(results, 'Monterrey, casanare').country, 'Colombia');
  assert.equal(pickPlace(results, 'Monterrey, Perú').country, 'México');
  assert.equal(pickPlace([], 'x'), null);
  assert.equal(pickPlace(undefined, 'x'), null);
});

test('clima: describe códigos del clima', () => {
  assert.deepEqual(describeWeather(0), ['Despejado', '☀️']);
  assert.deepEqual(describeWeather(95), ['Tormenta', '⛈️']);
  assert.equal(describeWeather(1234)[0], 'Clima raro');
});

// ── recuerda ──────────────────────────────────────────────────────────
test('recuerda: entiende tiempos', () => {
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration('10m'), 600);
  assert.equal(parseDuration('2h'), 7200);
  assert.equal(parseDuration('1h30m'), 5400);
  assert.equal(parseDuration('10'), null);
  assert.equal(parseDuration('mañana'), null);
  assert.equal(parseDuration(undefined), null);
  assert.equal(formatDuration(5400), '1h 30m');
  assert.equal(formatDuration(45), '45s');
});

// ── elige ─────────────────────────────────────────────────────────────
test('elige: separa opciones por comas, "o" o barras', () => {
  assert.deepEqual(parseOptions('pizza, tacos o sushi'), ['pizza', 'tacos', 'sushi']);
  assert.deepEqual(parseOptions('rojo | azul'), ['rojo', 'azul']);
  assert.deepEqual(parseOptions('comida o cena'), ['comida', 'cena']);
  assert.deepEqual(parseOptions('ropa'), ['ropa']);
});

test('elige: elige una de las opciones o pide más', async () => {
  const ctx = fakeCtx('pizza, tacos o sushi');
  await elige.run(ctx, () => 0.5);
  assert.deepEqual(ctx.replies, ['🎲 Elijo… *tacos*']);

  const few = fakeCtx('pizza');
  await elige.run(few);
  assert.match(few.replies[0], /al menos 2/);
});
