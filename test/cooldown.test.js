import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCooldowns } from '../src/core/cooldown.js';

function fakeClock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

test('la primera vez pasa y después bloquea', () => {
  const clock = fakeClock();
  const cooldowns = createCooldowns({ now: clock.now });

  assert.equal(cooldowns.hit('a', 10), 0);
  assert.equal(cooldowns.hit('a', 10), 10);
  clock.advance(4500);
  assert.equal(cooldowns.hit('a', 10), 6);
  clock.advance(5500);
  assert.equal(cooldowns.hit('a', 10), 0);
});

test('keys distintas no se afectan', () => {
  const cooldowns = createCooldowns({ now: fakeClock().now });
  assert.equal(cooldowns.hit('a', 10), 0);
  assert.equal(cooldowns.hit('b', 10), 0);
});

test('0 segundos nunca bloquea ni guarda nada', () => {
  const cooldowns = createCooldowns({ now: fakeClock().now });
  assert.equal(cooldowns.hit('a', 0), 0);
  assert.equal(cooldowns.hit('a', 0), 0);
  assert.equal(cooldowns.size, 0);
});

test('limpia keys vencidas para no crecer sin fin', () => {
  const clock = fakeClock();
  const cooldowns = createCooldowns({ now: clock.now });
  for (let i = 0; i < 1000; i++) cooldowns.hit(`k${i}`, 1);
  clock.advance(2000);
  cooldowns.hit('nueva', 1);
  assert.equal(cooldowns.size, 1);
});
