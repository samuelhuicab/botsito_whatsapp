import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildSystemPrompt,
  defaultPersonality,
  loadPersonality,
  normalizeRandomReplies,
} from '../src/ai/prompts.js';

function fakeLog() {
  const errors = [];
  return { errors, error: (obj, msg) => errors.push(msg) };
}

async function tempPrompt(t, source) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'botsito-prompt-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'prompt.js');
  if (source !== undefined) await writeFile(file, source);
  return file;
}

test('sin private/prompt.js → personalidad pública', async (t) => {
  const file = await tempPrompt(t);
  const result = await loadPersonality({ file, botName: 'Boomi', log: fakeLog() });
  assert.equal(result.source, 'default');
  assert.equal(result.personality, defaultPersonality({ botName: 'Boomi' }));
});

test('private/prompt.js con texto fijo', async (t) => {
  const file = await tempPrompt(t, "export default '  Eres un pirata.  ';");
  const result = await loadPersonality({ file, botName: 'Boomi', log: fakeLog() });
  assert.deepEqual(result, {
    personality: 'Eres un pirata.',
    randomReplies: [],
    source: 'private',
  });
});

test('private/prompt.js con función que recibe botName', async (t) => {
  const file = await tempPrompt(t, 'export default ({ botName }) => `Soy ${botName} el pirata`;');
  const result = await loadPersonality({ file, botName: 'Boomi', log: fakeLog() });
  assert.equal(result.personality, 'Soy Boomi el pirata');
});

test('private/prompt.js roto o vacío → pública, con error en el log', async (t) => {
  for (const source of ['export default ', "export default '   ';", 'export default 42;']) {
    const file = await tempPrompt(t, source);
    const log = fakeLog();
    const result = await loadPersonality({ file, botName: 'Boomi', log });
    assert.equal(result.source, 'default', source);
    assert.equal(log.errors.length, 1, source);
  }
});

test('la plantilla private/_prompt.js es válida', async () => {
  const file = path.resolve('private/_prompt.js');
  const result = await loadPersonality({ file, botName: 'Boomi', log: fakeLog() });
  assert.equal(result.source, 'private');
  assert.match(result.personality, /Boomi/);
});

test('lee randomReplies de private/prompt.js', async (t) => {
  const file = await tempPrompt(
    t,
    "export const randomReplies = [{ text: ' the game ', chance: 0.07 }];\nexport default 'hola';",
  );
  const result = await loadPersonality({ file, botName: 'Boomi', log: fakeLog() });
  assert.deepEqual(result.randomReplies, [{ text: 'the game', chance: 0.07 }]);
});

test('randomReplies inválido → error claro', () => {
  assert.deepEqual(normalizeRandomReplies(undefined), []);
  assert.throws(() => normalizeRandomReplies('the game'), /arreglo/);
  assert.throws(() => normalizeRandomReplies([{ chance: 0.1 }]), /text/);
  assert.throws(() => normalizeRandomReplies([{ text: 'x', chance: 7 }]), /entre 0 y 1/);
  assert.throws(() => normalizeRandomReplies([{ text: 'x' }]), /entre 0 y 1/);
});

test('en grupos se agrega la nota de formato, aunque la personalidad sea privada', () => {
  assert.equal(buildSystemPrompt({ personality: 'Eres un pirata.' }), 'Eres un pirata.');
  const inGroup = buildSystemPrompt({ personality: 'Eres un pirata.', isGroup: true });
  assert.match(inGroup, /^Eres un pirata\./);
  assert.match(inGroup, /"Nombre: mensaje"/);
});
