# CLAUDE.md — Botsito (bot de WhatsApp con IA gratis)

Este archivo le da contexto a Claude Code sobre el proyecto. Léelo completo antes de hacer cambios.

## Qué es el proyecto

Bot de WhatsApp **open source** pensado como **base extensible**: trae unos cuantos comandos públicos y cualquiera puede agregar los suyos, ya sea **públicos** (se suben al repo) o **privados** (solo viven en su servidor y nunca se suben).

El bot hace tres tipos de cosas, y deben estar claramente separadas:

| Tipo | Ejemplo | ¿Usa IA? | ¿Llama APIs externas? |
|---|---|---|---|
| Comando normal | `!ping`, `!help` | No | No |
| Comando con API externa | `!rank` (privado del dueño) | No | Sí, con `ctx.http` |
| Comando o plática con IA | `!resume`, "bot ¿qué onda?" | Sí, con `ctx.ai` | Solo la de IA |

Regla de oro: **la IA solo se llama a través de `ctx.ai`** (que usa el router de `src/ai/`). Ningún comando crea su propio cliente de IA. Así se controla la cuota gratis en un solo lugar.

Objetivo: que cualquiera pueda clonarlo, poner sus claves en `.env`, escanear un QR y tenerlo corriendo en un VPS pequeño (1 vCPU / 1–2 GB RAM, Ubuntu 24.04).

## Stack

- **Node.js 22 LTS o superior**, JavaScript con **ES Modules** (`"type": "module"`). Sin TypeScript para que sea fácil contribuir; JSDoc para tipos cuando ayude.
- **whatsapp-web.js** (sesión con `LocalAuth`, QR con `qrcode-terminal`).
  - Puppeteer con `args: ['--no-sandbox', '--disable-setuid-sandbox']`.
  - Todo lo de WhatsApp va detrás de un **adaptador** (`src/whatsapp/`) para poder cambiar a Baileys sin tocar comandos ni IA.
- **openai** (SDK) para todos los proveedores de IA (todos son compatibles con OpenAI).
- **`fetch` nativo** de Node para APIs externas (sin axios).
- **Sin base de datos.** Cooldowns e historial de IA viven en memoria. Si un comando necesita datos, los obtiene de su propia API.
- **dotenv** para configuración, **pino** para logs.
- Tests: `node --test`. Lint/formato: **ESLint** (flat config) + **Prettier**.
- Producción: **pm2** (`ecosystem.config.cjs`).

## Estructura

```
.
├── src/
│   ├── index.js                  # arranque: config → IA → comandos → WhatsApp
│   ├── config.js                 # lee y valida .env
│   ├── whatsapp/
│   │   └── client.js             # ÚNICO lugar que conoce whatsapp-web.js; emite mensajes normalizados
│   ├── handlers/
│   │   └── message.js            # "portero": ¿es comando? ¿mencionan al bot? ¿ignorar?
│   ├── core/
│   │   ├── loader.js             # carga comandos de commands/ y private/commands/
│   │   ├── context.js            # arma el objeto ctx que recibe cada comando
│   │   └── cooldown.js
│   ├── ai/
│   │   ├── providers.js          # proveedores desde .env (solo los que tienen clave)
│   │   ├── router.js             # ask(): fallback entre proveedores, maneja 429/5xx/timeout
│   │   ├── chat.js               # modo plática: historial corto por chat + personalidad
│   │   └── prompts.js            # system prompt del bot
│   └── utils/
│       ├── http.js               # fetch con timeout y errores claros (ctx.http)
│       └── logger.js
├── commands/                     # COMANDOS PÚBLICOS (se suben al repo)
│   ├── help.js
│   ├── ping.js
│   ├── ia.js                     # ejemplo de comando que usa ctx.ai
│   ├── traduce.js                # usa ctx.ai
│   ├── clima.js                  # Open-Meteo (sin clave) vía ctx.http
│   ├── cambio.js                 # open.er-api.com (sin clave) vía ctx.http
│   ├── recuerda.js               # recordatorios en memoria (se pierden al reiniciar)
│   ├── elige.js
│   └── calc.js                   # calculadora con parser propio (sin eval)
├── private/                      # TODO lo privado (en .gitignore, excepto las plantillas "_")
│   ├── _prompt.js                # plantilla de personalidad; se copia como prompt.js
│   ├── prompt.js                 # (del dueño, NO se sube) personalidad del bot; si no existe se usa src/ai/prompts.js
│   ├── media/                    # (del dueño, NO se sube) audios, imágenes, etc. para comandos privados
│   └── commands/
│       ├── _ejemplo.js           # plantilla que SÍ se sube; se ignora al cargar por empezar con "_"
│       └── rank.js               # (del dueño, NO se sube) llama a su API
├── scripts/
│   └── patch-whatsapp-web.js     # postinstall: parche temporal para enviar archivos (bug wwebjs #201922); quitar cuando salga el fix oficial
├── test/
├── data/                         # sesión de WhatsApp (en .gitignore)
├── .env.example
├── ecosystem.config.cjs
├── README.md
├── CONTRIBUTING.md               # cómo crear comandos públicos y privados
├── LICENSE                       # MIT
└── package.json
```

`commands/` y `private/` están fuera de `src/` a propósito: `src/` es el motor (casi nadie lo toca) y los comandos son lo que la gente edita.

## Comandos

### Formato

Cada archivo exporta por defecto:

```js
export default {
  name: 'rank',                 // se usa como !rank
  aliases: ['top'],             // opcional
  description: 'Muestra el ranking',
  usage: '!rank [usuario]',     // opcional, para !help
  usesAI: false,                // true si llama a ctx.ai (aplica cooldown de IA y 🤖 en !help)
  groupOnly: false,             // opcional
  ownerOnly: false,             // opcional, solo OWNER_NUMBER
  cooldownSeconds: 5,           // opcional
  async run(ctx) {
    await ctx.reply('...');
  },
};
```

### `ctx`

- `reply(texto)`, `react(emoji)`, `typing()` (muestra "escribiendo…")
- `replyFile(ruta, { caption, asDocument })`: responde con un archivo (audio, imagen, video, documento; el tipo sale de la extensión). Los archivos privados van en `private/media/`.
- `args` (array), `text` (texto después del comando)
- `sender` ({ id, name }), `chat` ({ id, isGroup, name }), `isOwner`
- `bot` ({ name, prefix }), `commands` (lista de comandos cargados, la usa `!help`)
- `http` → `ctx.http.get(url, opts)` / `ctx.http.post(url, body, opts)` (también `put`, `patch`, `delete`): fetch con timeout, devuelve JSON (o texto), lanza `HttpError` con `status` (null si no hubo respuesta). `opts`: `{ headers, query, timeout }`.
- `ai` → `ctx.ai.ask(prompt, { system })`: pasa por el router con fallback y siempre devuelve texto (un aviso amable si falla). Solo existe si `usesAI: true`; sin eso, lanza un error que explica el problema.
- `env` → `process.env` (para que los comandos privados lean sus propias claves).
- `log` → logger con el nombre del comando.

### Carga

- `src/core/loader.js` carga todos los `.js` de `commands/` y luego de `private/commands/`.
- Se ignoran archivos que empiezan con `_`.
- Si un comando privado tiene el mismo `name` que uno público, **el privado lo reemplaza** (log de aviso). Así alguien puede personalizar `!help` sin tocar el repo.
- Nombres/aliases duplicados dentro del mismo grupo → error claro al arrancar.
- Un comando que falla al cargar no tumba el bot: se loggea y se omite.
- `!help` se genera sola con `name`, `description`, `usage`, marcando 🤖 los que usan IA y 🔒 los privados.

### Secretos de comandos privados

Van en `.env` con cualquier nombre (ej. `RANK_API_URL`, `RANK_API_KEY`) y se leen con `ctx.env`. No se agregan a `.env.example` porque son privados. `_ejemplo.js` debe mostrar este patrón.

## Flujo de un mensaje (`handlers/message.js`)

1. Ignorar mensajes propios y `status@broadcast`.
2. Si empieza con `COMMAND_PREFIX` → buscar comando → validar `groupOnly`/`ownerOnly`/cooldown → `run(ctx)` dentro de try/catch (si falla: log + "Algo salió mal 😅").
3. Si empieza con `BOT_TRIGGER` o mencionan al bot → modo plática (`ai/chat.js`) con cooldown de IA.
4. Si no, no hacer nada (no gastar nada).

## Router de IA (reglas)

- Proveedores iniciales:
  - Groq — `https://api.groq.com/openai/v1`
  - Google Gemini — `https://generativelanguage.googleapis.com/v1beta/openai/`
  - OpenRouter (modelos `:free`) — `https://openrouter.ai/api/v1`
- Modelo configurable en `.env` (los nombres cambian seguido).
- Solo se activan proveedores con clave. Sin ninguno, el bot funciona sin IA y `ctx.ai.ask` responde un aviso amable.
- Orden = `AI_PROVIDER_ORDER`. 429 → bloquear `AI_COOLDOWN_ON_429` s. 5xx/timeout → siguiente. 401/403 → log "clave inválida de X" y desactivar hasta reiniciar.
- Timeout ~20 s, `max_tokens` bajo (≈300). Si todos fallan, mensaje amable, nunca crashear.
- Historial en memoria de los últimos `AI_HISTORY_SIZE` mensajes por chat (solo modo plática).
- Personalidad (system prompt): `private/prompt.js` (texto o función `({ botName }) => texto`) si existe; si no, la pública de `src/ai/prompts.js`. En grupos siempre se agrega la nota de formato "Nombre: mensaje". Opcional: `export const randomReplies = [{ text, chance }]` en `private/prompt.js` → respuestas al azar en modo plática, sin usar IA.
- Nunca loggear claves ni contenido completo de mensajes.

## Reglas del proyecto

- `.gitignore` debe incluir: `node_modules/`, `.env`, `data/`, `.wwebjs_auth/`, `.wwebjs_cache/`, `private/*` con excepciones `!private/_prompt.js` y `!private/commands/` → `private/commands/*` + `!private/commands/_ejemplo.js`. Verificar con `git status` que un comando privado de prueba NO aparece.
- Configuración general en `.env`, documentada en `.env.example` con comentarios en español.
- Mensajes al usuario: español, cortos, con buena onda.
- Código: identificadores en inglés; comentarios y docs en español.
- Mantener dependencias al mínimo; preguntar antes de agregar una.
- README con aviso: whatsapp-web.js no es oficial y puede causar baneo del número; usar número secundario.

## Variables de entorno (.env.example)

```
BOT_NAME=botsito
BOT_TRIGGER=bot
COMMAND_PREFIX=!
OWNER_NUMBER=                  # ej. 5215512345678

AI_USER_COOLDOWN=10
AI_HISTORY_SIZE=6
AI_MAX_TOKENS=300
AI_COOLDOWN_ON_429=60
AI_PROVIDER_ORDER=groq,gemini,openrouter

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-lite-latest
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free

HTTP_TIMEOUT=10
LOG_LEVEL=info

# Variables de tus comandos privados van abajo (no las subas):
```

## Comandos de desarrollo

```bash
npm install
npm run dev        # node --watch src/index.js
npm start
npm test
npm run lint
npm run format
pm2 start ecosystem.config.cjs
```

## Plan de trabajo (en orden)

1. **Base** (package.json, dependencias y carpetas ya existen; revisar y completar): ESLint/Prettier, `.gitignore` con las reglas de `private/`, `.env.example`, `LICENSE`, `config.js`, logger.
2. **WhatsApp**: adaptador, QR, sesión persistente, mensajes normalizados.
3. **Comandos**: loader (públicos + privados + override), `ctx`, cooldowns, handler, `!ping`, `!help`, `private/commands/_ejemplo.js`. Tests del loader.
4. **HTTP**: `utils/http.js` y `ctx.http`. El ejemplo privado muestra cómo llamar una API con clave de `.env`.
5. **IA**: providers + router + `ctx.ai` + modo plática + `commands/ia.js`. Tests del router con proveedores falsos (429, 500, timeout).
6. **Producción**: `ecosystem.config.cjs`, guía de Ubuntu 24.04 en el README.
7. **Open source**: README, `CONTRIBUTING.md` (crear comando público vs privado), plantillas de issues, GitHub Actions con lint + tests.

Ideas para después (no hacer hasta que lo pidan): `!sticker`, configuración por grupo, personalidades, soporte Baileys.

## Cómo trabajar conmigo (para Claude Code)

- Un paso del plan a la vez; al terminar, di qué hiciste y cómo probarlo.
- Antes de cambios grandes de estructura, propón el plan y espera confirmación.
- Nunca crees ni modifiques archivos en `private/` salvo `_ejemplo.js`, a menos que te lo pida.
- Tests cuando toques loader, router o cooldowns.
- Si algo del stack cambió (versiones, modelos, API de whatsapp-web.js), revisa la documentación actual.
