import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneFromId, isBotMentioned } from '../src/whatsapp/client.js';

test('phoneFromId saca el número de ids @c.us', () => {
  assert.equal(phoneFromId('5215512345678@c.us'), '5215512345678');
  assert.equal(phoneFromId('5215512345678:12@c.us'), '5215512345678');
});

test('phoneFromId devuelve null para grupos, lids o vacío', () => {
  assert.equal(phoneFromId('120363000000000000@g.us'), null);
  assert.equal(phoneFromId('123456789012345@lid'), null);
  assert.equal(phoneFromId(undefined), null);
});

test('isBotMentioned detecta al bot por @c.us o @lid', () => {
  const botIds = new Set(['5215500000000@c.us', '999@lid']);
  assert.equal(isBotMentioned(['111@c.us', '999@lid'], botIds), true);
  assert.equal(isBotMentioned(['5215500000000@c.us'], botIds), true);
  assert.equal(isBotMentioned(['111@c.us'], botIds), false);
  assert.equal(isBotMentioned(undefined, botIds), false);
});
