# Cómo contribuir

¡Gracias por querer ayudar! Esta guía explica cómo preparar el proyecto y, sobre todo, **cómo crear comandos**, que es lo que más se edita.

## Preparar el proyecto

```bash
git clone https://github.com/samuelhuicab/Bot_15_Diciembre.git
cd Bot_15_Diciembre
npm install
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm run dev
```

Necesitas Node.js 22 o superior. Detalles en el [README](README.md#-empezar-en-tu-computadora).

## ¿Público o privado?

|                   | Comando **público**                    | Comando **privado**                         |
| ----------------- | -------------------------------------- | ------------------------------------------- |
| Carpeta           | `commands/`                            | `private/commands/`                         |
| ¿Se sube al repo? | Sí, lo usan todos                      | **No**, solo vive en tu servidor            |
| Ideal para        | Cosas útiles para cualquiera           | Tu API, chistes internos, cosas de tu grupo |
| Claves de APIs    | Solo APIs **sin clave** o con `ctx.ai` | Las que quieras, en tu `.env`               |
| En `!help`        | Normal                                 | Marcado como privado                        |

Si un comando privado tiene el mismo `name` que uno público, **el privado lo reemplaza**. Así puedes personalizar, por ejemplo, `!help` sin tocar el repo.

## Crear un comando

Cada comando es un archivo `.js` que exporta un objeto. El nombre del archivo no importa; se usa `name`.

```js
// commands/saludo.js
export default {
  name: 'saludo', // se usa como !saludo (minúsculas, números, - o _)
  aliases: ['hola'], // opcional: también responde a !hola
  description: 'Te saluda', // sale en !help
  usage: '!saludo [nombre]', // opcional, sale en !help saludo
  usesAI: false, // true si usa ctx.ai (aplica el cooldown de IA)
  groupOnly: false, // opcional: solo en grupos
  ownerOnly: false, // opcional: solo OWNER_NUMBER (y no sale en !help para los demás)
  cooldownSeconds: 5, // opcional (3 por defecto)

  async run(ctx) {
    const who = ctx.text || ctx.sender.name || 'amigo';
    await ctx.reply(`¡Hola, ${who}!`);
  },
};
```

Reinicia el bot (con `npm run dev` se reinicia solo) y prueba `!saludo`.

- Archivos que empiezan con `_` **no se cargan** (sirven de plantilla).
- Si un comando tiene un error al cargar, el bot lo avisa en el log y sigue funcionando sin él.
- Nombres o aliases repetidos entre comandos del mismo grupo → el bot no arranca y te dice cuáles chocan.
- Si `run()` lanza un error, el bot responde "Algo salió mal 😅" y lo registra en el log.

### Lo que recibe `ctx`

| Propiedad                                      | Qué es                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ctx.reply(texto)`                             | Responde citando el mensaje                                                                                  |
| `ctx.react(emoji)`                             | Reacciona al mensaje                                                                                         |
| `ctx.typing()`                                 | Muestra "escribiendo…"                                                                                       |
| `ctx.replyFile(ruta, { caption, asDocument })` | Responde con un archivo (audio, imagen, video, documento)                                                    |
| `ctx.args` / `ctx.text`                        | Argumentos: `!rank juan 2` → `['juan', '2']` / `'juan 2'`                                                    |
| `ctx.sender`                                   | `{ id, name }` de quien escribió                                                                             |
| `ctx.chat`                                     | `{ id, isGroup, name }`                                                                                      |
| `ctx.isOwner`                                  | `true` si escribió `OWNER_NUMBER`                                                                            |
| `ctx.bot`                                      | `{ name, prefix }`                                                                                           |
| `ctx.commands`                                 | Lista de comandos cargados                                                                                   |
| `ctx.http`                                     | `get(url, opts)`, `post(url, body, opts)`, `put`, `patch`, `delete`. Opciones: `{ headers, query, timeout }` |
| `ctx.ai`                                       | `ask(prompt, { system })` → siempre devuelve texto. **Solo con `usesAI: true`**                              |
| `ctx.env`                                      | Variables del `.env` (para claves de comandos privados)                                                      |
| `ctx.log`                                      | Logger con el nombre del comando (`ctx.log.warn(...)`)                                                       |

### Llamar una API externa

`ctx.http` ya trae timeout, devuelve el JSON y lanza errores claros con `err.status` (`null` si no hubo respuesta):

```js
async run(ctx) {
  try {
    const data = await ctx.http.get('https://api.ejemplo.com/cosas', { query: { q: ctx.text } });
    await ctx.reply(`Encontré ${data.total} cosas`);
  } catch (err) {
    ctx.log.warn({ status: err.status }, 'Falló la API');
    await ctx.reply('La API no respondió, intenta más tarde.');
  }
}
```

Ejemplos reales: [`commands/clima.js`](commands/clima.js) y [`commands/cambio.js`](commands/cambio.js).

### Usar la IA

Marca `usesAI: true` y usa `ctx.ai.ask()`. **Nunca crees tu propio cliente de IA**: todo pasa por el router para cuidar la cuota gratis y tener respaldo entre proveedores.

```js
export default {
  name: 'chiste',
  description: 'Cuenta un chiste',
  usesAI: true,
  async run(ctx) {
    await ctx.typing();
    const joke = await ctx.ai.ask(ctx.text || 'cualquier tema', {
      system: 'Cuenta un chiste corto y limpio en español sobre el tema que te den.',
    });
    await ctx.reply(joke);
  },
};
```

Ejemplos reales: [`commands/ia.js`](commands/ia.js) y [`commands/traduce.js`](commands/traduce.js).

### Comandos privados con claves

1. Copia [`private/commands/_ejemplo.js`](private/commands/_ejemplo.js) como `private/commands/micomando.js`.
2. Pon sus claves **al final de tu `.env`** (no en `.env.example`, porque son privadas):
   ```
   MICOMANDO_API_KEY=tu-clave
   ```
3. Léelas con `ctx.env.MICOMANDO_API_KEY`.

## Reglas del proyecto

- **Código:** identificadores en inglés; comentarios, docs y mensajes al usuario en **español**.
- **Mensajes del bot:** cortos y con buena onda.
- **Dependencias:** las mínimas. Si tu cambio necesita una nueva, **pregunta primero** en un issue.
- **WhatsApp:** solo `src/whatsapp/` puede usar `whatsapp-web.js`. Los comandos usan `ctx`.
- **Nunca** loggear claves ni el contenido completo de los mensajes.
- **Tests:** si tocas el loader, el router de IA, los cooldowns o la lógica de un comando, agrega o actualiza tests en `test/`. Si tu comando tiene lógica propia (parsear, calcular), expórtala como función con nombre para poder probarla (mira [`test/commands.test.js`](test/commands.test.js)).

## Antes de mandar un Pull Request

```bash
npm run lint
npm run format:check
npm test
```

Los tres deben pasar (GitHub Actions los corre en cada PR). Luego:

1. Haz un fork y una rama con un nombre claro (`comando-clima`, `fix-cooldown`…).
2. Describe en el PR **qué** cambia y **cómo probarlo**.
3. Un cambio por PR, de preferencia.

¿Dudas o ideas? Abre un [issue](https://github.com/samuelhuicab/Bot_15_Diciembre/issues).
