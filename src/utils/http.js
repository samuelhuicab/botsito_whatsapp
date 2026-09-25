// Cliente HTTP para APIs externas (ctx.http): fetch nativo con timeout y errores claros.
// Nunca pone la URL completa en los errores: los query params pueden traer claves.

/** Error de una llamada HTTP. `status` es null si ni siquiera hubo respuesta (timeout, red). */
export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number | null, url: string, body?: unknown, cause?: unknown }} details
   */
  constructor(message, { status = null, url, body, cause }) {
    super(message, { cause });
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/** Deja solo origen + ruta (sin query ni credenciales) para errores y logs. */
export function safeUrl(url) {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return '(url inválida)';
  }
}

function buildUrl(url, query) {
  if (!query) return url;
  const full = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) full.searchParams.set(key, String(value));
  }
  return full.toString();
}

async function readBody(response) {
  const text = await response.text();
  const isJson = (response.headers.get('content-type') ?? '').includes('json');
  if (!isJson || !text) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {{ timeoutSeconds?: number, fetchImpl?: typeof fetch }} [options]
 */
export function createHttp({ timeoutSeconds = 10, fetchImpl = fetch } = {}) {
  /**
   * @param {string} method
   * @param {string} url
   * @param {{ headers?: Record<string, string>, query?: Record<string, unknown>, body?: unknown, timeout?: number }} [opts]
   */
  async function request(method, url, opts = {}) {
    const timeout = opts.timeout ?? timeoutSeconds;
    const target = safeUrl(url);
    const headers = { accept: 'application/json', ...opts.headers };

    let body;
    if (opts.body !== undefined) {
      if (typeof opts.body === 'string') {
        body = opts.body;
      } else {
        body = JSON.stringify(opts.body);
        headers['content-type'] ??= 'application/json';
      }
    }

    let response;
    try {
      response = await fetchImpl(buildUrl(url, opts.query), {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeout * 1000),
      });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new HttpError(`La API tardó más de ${timeout}s en responder (${target})`, {
          url: target,
          cause: err,
        });
      }
      throw new HttpError(`No se pudo conectar con ${target}`, { url: target, cause: err });
    }

    let data;
    try {
      data = await readBody(response);
    } catch (err) {
      throw new HttpError(`Se cortó la respuesta de ${target}`, {
        status: response.status,
        url: target,
        cause: err,
      });
    }

    if (!response.ok) {
      const status = [response.status, response.statusText].filter(Boolean).join(' ');
      throw new HttpError(`La API respondió ${status} (${target})`, {
        status: response.status,
        url: target,
        body: data,
      });
    }
    return data;
  }

  return {
    /** GET → devuelve el JSON (o texto si la API no responde JSON). */
    get: (url, opts) => request('GET', url, opts),
    /** POST con body (objeto → JSON). */
    post: (url, body, opts) => request('POST', url, { ...opts, body }),
    put: (url, body, opts) => request('PUT', url, { ...opts, body }),
    patch: (url, body, opts) => request('PATCH', url, { ...opts, body }),
    delete: (url, opts) => request('DELETE', url, opts),
  };
}
