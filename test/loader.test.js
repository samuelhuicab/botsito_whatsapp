import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCommands, normalizeCommand } from '../src/core/loader.js';

/** Logger falso que guarda lo que se loggea. */
function fakeLog() {
  const entries = [];
  const push = (level) => (obj, msg) => entries.push({ level, obj, msg });
  return { entries, info: push('info'), warn: push('warn'), error: push('error') };
}

function commandSource({ name, aliases = [], extra = '' }) {
  return `export default { name: '${name}', aliases: ${JSON.stringify(aliases)}, description: '${name}', ${extra} async run() {} };\n`;
}

/** Crea carpetas temporales con los archivos indicados: { 'ping.js': '...' }. */
async function setup(t, { publicFiles = {}, privateFiles = {} }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'botsito-loader-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const publicDir = path.join(root, 'commands');
  const privateDir = path.join(root, 'private', 'commands');
  await mkdir(publicDir, { recursive: true });
  await mkdir(privateDir, { recursive: true });
  for (const [file, src] of Object.entries(publicFiles)) {
    await writeFile(path.join(publicDir, file), src);
  }
  for (const [file, src] of Object.entries(privateFiles)) {
    await writeFile(path.join(privateDir, file), src);
  }
  return { publicDir, privateDir };
}

test('carga públicos y privados, y busca por nombre o alias', async (t) => {
  const dirs = await setup(t, {
    publicFiles: { 'ping.js': commandSource({ name: 'ping', aliases: ['p'] }) },
    privateFiles: { 'rank.js': commandSource({ name: 'rank', aliases: ['top'] }) },
  });
  const registry = await loadCommands({ ...dirs, log: fakeLog() });

  assert.deepEqual(
    registry.list.map((c) => c.name),
    ['ping', 'rank'],
  );
  assert.equal(registry.find('P').name, 'ping');
  assert.equal(registry.find('top').name, 'rank');
  assert.equal(registry.find('rank').isPrivate, true);
  assert.equal(registry.find('ping').isPrivate, false);
  assert.equal(registry.find('nada'), undefined);
});

test('ignora archivos que empiezan con "_" y los que no son .js', async (t) => {
  const dirs = await setup(t, {
    publicFiles: { 'ping.js': commandSource({ name: 'ping' }), 'notas.txt': 'hola' },
    privateFiles: { '_ejemplo.js': commandSource({ name: 'ejemplo' }) },
  });
  const registry = await loadCommands({ ...dirs, log: fakeLog() });
  assert.deepEqual(
    registry.list.map((c) => c.name),
    ['ping'],
  );
});

test('un privado reemplaza al público con el mismo nombre (y sus aliases)', async (t) => {
  const dirs = await setup(t, {
    publicFiles: { 'ayuda.js': commandSource({ name: 'ayuda', aliases: ['help'] }) },
    privateFiles: { 'ayuda.js': commandSource({ name: 'ayuda', aliases: ['h'] }) },
  });
  const log = fakeLog();
  const registry = await loadCommands({ ...dirs, log });

  assert.equal(registry.list.length, 1);
  assert.equal(registry.find('ayuda').isPrivate, true);
  assert.equal(registry.find('h').isPrivate, true);
  assert.equal(registry.find('help'), undefined);
  assert.ok(log.entries.some((e) => e.level === 'warn' && /reemplaza/.test(e.msg)));
});

test('nombres o aliases repetidos en el mismo grupo → error claro', async (t) => {
  const dirs = await setup(t, {
    publicFiles: {
      'a.js': commandSource({ name: 'uno', aliases: ['x'] }),
      'b.js': commandSource({ name: 'dos', aliases: ['x'] }),
    },
  });
  await assert.rejects(loadCommands({ ...dirs, log: fakeLog() }), /"x" está repetido/);
});

test('un comando roto se omite sin tumbar a los demás', async (t) => {
  const dirs = await setup(t, {
    publicFiles: {
      'ping.js': commandSource({ name: 'ping' }),
      'roto.js': 'export default { name: "roto" ',
      'sinrun.js': "export default { name: 'sinrun' };",
    },
  });
  const log = fakeLog();
  const registry = await loadCommands({ ...dirs, log });

  assert.deepEqual(
    registry.list.map((c) => c.name),
    ['ping'],
  );
  assert.equal(log.entries.filter((e) => e.level === 'error').length, 2);
});

test('carpeta privada inexistente no es error', async (t) => {
  const dirs = await setup(t, { publicFiles: { 'ping.js': commandSource({ name: 'ping' }) } });
  const registry = await loadCommands({
    publicDir: dirs.publicDir,
    privateDir: path.join(dirs.privateDir, 'no-existe'),
    log: fakeLog(),
  });
  assert.equal(registry.list.length, 1);
});

test('normalizeCommand valida y pone valores por defecto', () => {
  const cmd = normalizeCommand({ name: 'Rank', aliases: ['TOP'], run() {} }, 'rank.js');
  assert.equal(cmd.name, 'rank');
  assert.deepEqual(cmd.aliases, ['top']);
  assert.equal(cmd.usesAI, false);
  assert.equal(cmd.description, '');

  assert.throws(() => normalizeCommand(undefined, 'x.js'), /export default/);
  assert.throws(() => normalizeCommand({ name: 'con espacio', run() {} }, 'x.js'), /name/);
  assert.throws(() => normalizeCommand({ name: 'ok' }, 'x.js'), /run/);
  assert.throws(() => normalizeCommand({ name: 'ok', aliases: 'x', run() {} }, 'x.js'), /aliases/);
  assert.throws(
    () => normalizeCommand({ name: 'ok', cooldownSeconds: -1, run() {} }, 'x.js'),
    /cooldownSeconds/,
  );
});
