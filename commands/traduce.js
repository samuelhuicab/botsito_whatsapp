// !traduce <idioma> <texto> — traduce con la IA.

// Atajos de idioma para que se pueda escribir "!traduce en hola".
const LANGUAGES = {
  en: 'inglés',
  es: 'español',
  fr: 'francés',
  pt: 'portugués',
  it: 'italiano',
  de: 'alemán',
  ja: 'japonés',
  ko: 'coreano',
  zh: 'chino',
  ru: 'ruso',
};

export default {
  name: 'traduce',
  aliases: ['traducir', 'tr'],
  description: 'Traduce un texto a otro idioma',
  usage: '!traduce <idioma> <texto> (ej. !traduce inglés ¿dónde está el baño?)',
  usesAI: true,

  async run(ctx) {
    const [language, ...words] = ctx.args;
    const text = words.join(' ').trim();
    if (!language || !text) {
      await ctx.reply(`Así: ${ctx.bot.prefix}traduce inglés ¿dónde está el baño? 🌐`);
      return;
    }

    const target = LANGUAGES[language.toLowerCase()] ?? language;
    await ctx.typing();
    const translation = await ctx.ai.ask(`Idioma destino: ${target}\nTexto:\n${text}`, {
      system:
        'Eres un traductor. Traduce el texto al idioma destino de forma natural. ' +
        'Responde SOLO con la traducción, sin comillas, explicaciones ni notas. ' +
        'Si el idioma destino no existe, responde: "No conozco ese idioma".',
    });
    await ctx.reply(`🌐 ${translation}`);
  },
};
