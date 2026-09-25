import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('usa valores por defecto con env vacío', () => {
  const config = loadConfig({});
  assert.equal(config.bot.name, 'botsito');
  assert.equal(config.bot.commandPrefix, '!');
  assert.equal(config.ai.maxTokens, 300);
  assert.deepEqual(config.ai.providerOrder, ['groq', 'gemini', 'openrouter']);
  assert.equal(config.logLevel, 'info');
});

test('lee valores del env', () => {
  const config = loadConfig({
    BOT_TRIGGER: 'Robot',
    OWNER_NUMBER: '5215512345678',
    AI_MAX_TOKENS: '150',
    AI_PROVIDER_ORDER: 'gemini, groq',
    GROQ_API_KEY: 'abc',
  });
  assert.equal(config.bot.trigger, 'robot');
  assert.equal(config.bot.ownerNumber, '5215512345678');
  assert.equal(config.ai.maxTokens, 150);
  assert.deepEqual(config.ai.providerOrder, ['gemini', 'groq']);
  assert.equal(config.ai.providers.groq.apiKey, 'abc');
});

test('junta todos los errores en un solo mensaje', () => {
  assert.throws(
    () =>
      loadConfig({
        OWNER_NUMBER: '+52 55',
        AI_MAX_TOKENS: 'mucho',
        AI_PROVIDER_ORDER: 'groq,chatgpt',
        LOG_LEVEL: 'verbose',
      }),
    (err) => {
      assert.match(err.message, /OWNER_NUMBER/);
      assert.match(err.message, /AI_MAX_TOKENS/);
      assert.match(err.message, /chatgpt/);
      assert.match(err.message, /LOG_LEVEL/);
      return true;
    },
  );
});

test('la configuración es inmutable', () => {
  const config = loadConfig({});
  assert.throws(() => {
    config.bot.name = 'otro';
  }, TypeError);
});
