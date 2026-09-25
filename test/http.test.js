import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHttp, HttpError, safeUrl } from '../src/utils/http.js';

// Servidor local de pruebas: nada sale a internet.
let server;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (url.pathname === '/json') {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            method: req.method,
            query: Object.fromEntries(url.searchParams),
            auth: req.headers.authorization ?? null,
            body: raw ? JSON.parse(raw) : null,
          }),
        );
      } else if (url.pathname === '/text') {
        res.setHeader('content-type', 'text/plain');
        res.end('hola');
      } else if (url.pathname === '/slow') {
        setTimeout(() => res.end('tarde'), 2000);
      } else {
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'no existe' }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test('GET devuelve JSON y manda query y headers', async () => {
  const client = createHttp();
  const data = await client.get(`${base}/json`, {
    query: { user: 'ana', page: 2, vacio: undefined },
    headers: { authorization: 'Bearer secreto' },
  });
  assert.deepEqual(data, {
    method: 'GET',
    query: { user: 'ana', page: '2' },
    auth: 'Bearer secreto',
    body: null,
  });
});

test('POST manda el body como JSON', async () => {
  const data = await createHttp().post(`${base}/json`, { score: 10 });
  assert.equal(data.method, 'POST');
  assert.deepEqual(data.body, { score: 10 });
});

test('si la API no responde JSON, devuelve texto', async () => {
  assert.equal(await createHttp().get(`${base}/text`), 'hola');
});

test('status de error → HttpError con status y body, sin la query en el mensaje', async () => {
  await assert.rejects(createHttp().get(`${base}/nada`, { query: { key: 'secreto' } }), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 404);
    assert.deepEqual(err.body, { error: 'no existe' });
    assert.match(err.message, /404/);
    assert.doesNotMatch(err.message, /secreto/);
    return true;
  });
});

test('timeout → HttpError claro', async () => {
  await assert.rejects(createHttp().get(`${base}/slow`, { timeout: 0.2 }), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, null);
    assert.match(err.message, /tardó más de 0.2s/);
    return true;
  });
});

test('sin conexión → HttpError claro', async () => {
  const failingFetch = () => Promise.reject(new TypeError('fetch failed'));
  await assert.rejects(
    createHttp({ fetchImpl: failingFetch }).get('https://api.ejemplo.com/x?key=secreto'),
    (err) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.message, 'No se pudo conectar con https://api.ejemplo.com/x');
      return true;
    },
  );
});

test('safeUrl quita query y credenciales', () => {
  assert.equal(safeUrl('https://user:pass@api.com/v1/rank?key=abc'), 'https://api.com/v1/rank');
  assert.equal(safeUrl('no es url'), '(url inválida)');
});
