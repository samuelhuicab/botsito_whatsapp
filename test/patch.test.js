import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { applyPatch } from '../scripts/patch-whatsapp-web.js';

const SAMPLE = `        const message = {
            ...options,
            ...mediaOptions,
            ...extraOptions,
        };

        // Bot's won't reply if canonicalUrl is set (linking)
`;

test('inserta el delete justo después de armar el mensaje', () => {
  const { code, status } = applyPatch(SAMPLE);
  assert.equal(status, 'patched');
  assert.match(
    code,
    /\.\.\.extraOptions,\n {8}\};\n\n {8}\/\* botsito-patch: __x_id \*\/\n {8}delete message\.__x_id;\n/,
  );
});

test('es idempotente', () => {
  const once = applyPatch(SAMPLE).code;
  const twice = applyPatch(once);
  assert.equal(twice.status, 'already-patched');
  assert.equal(twice.code, once);
});

test('si el código cambió, no toca nada', () => {
  const { code, status } = applyPatch('const otra = "cosa";');
  assert.equal(status, 'anchor-not-found');
  assert.equal(code, 'const otra = "cosa";');
});

test('el Utils.js instalado tiene el parche aplicado', async () => {
  const require = createRequire(import.meta.url);
  const pkgDir = path.dirname(require.resolve('whatsapp-web.js/package.json'));
  const utils = await readFile(path.join(pkgDir, 'src/util/Injected/Utils.js'), 'utf8');
  assert.match(utils, /delete message\.__x_id;/);
});
