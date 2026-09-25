// Guarda el QR de WhatsApp como página HTML (imagen SVG), por si la terminal no lo dibuja bien
// (pasa en Windows con consolas que no usan UTF-8). Usa el generador que trae qrcode-terminal,
// así no se agrega ninguna dependencia.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

/** Convierte un texto en un SVG de código QR. */
export function qrToSvg(text, { scale = 8, margin = 4 } = {}) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const size = (count + margin * 2) * scale;
  let cells = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        cells += `M${(col + margin) * scale} ${(row + margin) * scale}h${scale}v${scale}h-${scale}z`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${cells}" fill="#000"/></svg>`
  );
}

function qrPage(text) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="5">
<title>QR de WhatsApp</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f0f2f5;
         font-family: system-ui, sans-serif; color: #111; text-align: center; }
  .card { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 12px #0002; }
  svg { max-width: 80vmin; height: auto; }
</style>
</head>
<body>
<div class="card">
  <h2>Escanea con WhatsApp</h2>
  <p>WhatsApp → Dispositivos vinculados → Vincular un dispositivo</p>
  ${qrToSvg(text)}
  <p><small>Se actualiza sola. Cuando el bot se conecte, este archivo se borra.</small></p>
</div>
</body>
</html>
`;
}

/** Escribe (o reescribe) la página del QR. */
export async function writeQrPage(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, qrPage(text), 'utf8');
}

/** Borra la página del QR (si existe). */
export async function removeQrPage(file) {
  await rm(file, { force: true });
}

/** Abre el archivo en el navegador (solo Windows y macOS; en un servidor no hace nada). */
export function openInBrowser(file) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', file]]
      : process.platform === 'darwin'
        ? ['open', [file]]
        : [null, []];
  if (!cmd) return false;
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return true;
}
