// PLANTILLA de comando privado que llama a una API externa.
//
// Los comandos en private/commands/ solo viven en tu servidor: git los ignora.
// Este archivo sí se sube porque empieza con "_", y por lo mismo el bot NO lo carga.
//
// Para usarlo:
//   1. Cópialo con otro nombre, ej. private/commands/rank.js
//   2. Cambia name, description, etc.
//   3. Agrega tus claves al FINAL de tu .env (no a .env.example, porque son privadas):
//        EJEMPLO_API_URL=https://tu-api.com/ranking
//        EJEMPLO_API_KEY=tu-clave
//   4. Reinicia el bot. Aparecerá en !ayuda con 🔒.
//
// Si le pones el mismo name que un comando público (ej. 'ayuda'), el tuyo lo reemplaza.

export default {
  name: 'ejemplo',
  aliases: ['ej'],
  description: 'Comando privado de ejemplo que consulta una API',
  usage: '!ejemplo [usuario]',
  usesAI: false, // pon true si usas ctx.ai
  groupOnly: false, // true = solo en grupos
  ownerOnly: false, // true = solo OWNER_NUMBER
  cooldownSeconds: 5,

  async run(ctx) {
    // 1. Las claves se leen con ctx.env (vienen de tu .env).
    const { EJEMPLO_API_URL: apiUrl, EJEMPLO_API_KEY: apiKey } = ctx.env;
    if (!apiUrl || !apiKey) {
      ctx.log.warn('Faltan EJEMPLO_API_URL o EJEMPLO_API_KEY en .env');
      await ctx.reply('Este comando aún no está configurado 🛠️');
      return;
    }

    // 2. Llamar la API con ctx.http (ya trae timeout y devuelve el JSON).
    //    Si falla, ctx.http lanza un error con err.status (404, 500…) o null si no hubo respuesta.
    const user = ctx.args[0] ?? ctx.sender.name ?? 'anónimo';
    let data;
    try {
      data = await ctx.http.get(apiUrl, {
        query: { user },
        headers: { authorization: `Bearer ${apiKey}` },
      });
    } catch (err) {
      ctx.log.warn({ status: err.status, err: err.message }, 'La API falló');
      await ctx.reply(
        err.status === 404 ? `No encontré a ${user} 🤷` : 'La API no respondió, intenta luego 😅',
      );
      return;
    }

    // 3. Responder. Ajusta esto a la forma de tu JSON.
    await ctx.reply(`📊 ${user}: ${JSON.stringify(data).slice(0, 500)}`);
  },
};
