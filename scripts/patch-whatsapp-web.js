// Parche temporal para whatsapp-web.js 1.34.7: enviar archivos (audio, imagen, video, documento)
// falla con "Data passed to getter must include an id property" desde que WhatsApp Web cambió
// el 2026-09-17. La librería copia el campo interno __x_id del MediaData al mensaje, y WhatsApp
// lo toma como id. El arreglo es borrarlo antes de crear el mensaje.
// Bug: https://github.com/wwebjs/whatsapp-web.js/issues/201922
//
// Corre solo después de `npm install` / `npm ci` (script "postinstall" en package.json).
// Es idempotente y nunca rompe la instalación: si el código de la librería cambió, solo avisa.
// Cuando salga una versión oficial con el arreglo, se puede borrar este archivo y el postinstall.

import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '/* botsito-patch: __x_id */';
const ANCHOR = /(\n(\s*)\.\.\.extraOptions,\n\s*\};\n)/;

/**
 * Aplica el parche al código de Utils.js. Devuelve { code, status }.
 * status: 'patched' | 'already-patched' | 'anchor-not-found'
 * @param {string} code
 */
export function applyPatch(code) {
  if (code.includes(MARKER)) return { code, status: 'already-patched' };
  const match = code.match(ANCHOR);
  if (!match) return { code, status: 'anchor-not-found' };

  const indent = match[2].slice(4); // mismo nivel que `const message = {`
  const insertion = `\n${indent}${MARKER}\n${indent}delete message.__x_id;\n`;
  return { code: code.replace(ANCHOR, `$1${insertion}`), status: 'patched' };
}

async function main() {
  let utilsPath;
  try {
    const require = createRequire(import.meta.url);
    const pkgDir = path.dirname(require.resolve('whatsapp-web.js/package.json'));
    utilsPath = path.join(pkgDir, 'src', 'util', 'Injected', 'Utils.js');
  } catch {
    console.warn('[patch-whatsapp-web] whatsapp-web.js no está instalado; nada que parchar.');
    return;
  }

  const original = await readFile(utilsPath, 'utf8');
  const { code, status } = applyPatch(original);

  if (status === 'patched') {
    await writeFile(utilsPath, code, 'utf8');
    console.log('[patch-whatsapp-web] Parche aplicado: ya se pueden enviar archivos.');
  } else if (status === 'already-patched') {
    console.log('[patch-whatsapp-web] El parche ya estaba aplicado.');
  } else {
    console.warn(
      '[patch-whatsapp-web] No se encontró dónde aplicar el parche (¿cambió la versión de whatsapp-web.js?). ' +
        'Si enviar archivos funciona, borra scripts/patch-whatsapp-web.js y el postinstall.',
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    // Nunca romper la instalación por el parche.
    console.warn(`[patch-whatsapp-web] No se pudo aplicar el parche: ${err.message}`);
  });
}
