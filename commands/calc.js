// !calc <operación> — calculadora segura (no usa eval).
// Soporta: + - * / ^, paréntesis, porcentaje (200*15%), x o × para multiplicar,
// funciones raiz/sqrt, abs, redondea/round, log, ln, sin, cos, tan, y las constantes pi y e.

const FUNCTIONS = {
  raiz: Math.sqrt,
  sqrt: Math.sqrt,
  abs: Math.abs,
  redondea: Math.round,
  round: Math.round,
  log: Math.log10,
  ln: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const MAX_LENGTH = 200;

function tokenize(input) {
  const tokens = [];
  const text = input
    .toLowerCase()
    .replace(/[×x]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'raiz')
    .replace(/,/g, '.');
  const pattern = /\s*(\d+(?:\.\d+)?|\.\d+|[a-zñ]+|[-+*/^%()])/y;
  let index = 0;
  while (index < text.length) {
    if (/\s/.test(text[index])) {
      index++;
      continue;
    }
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (!match) throw new Error(`No entiendo "${text[index]}"`);
    tokens.push(match[1]);
    index = pattern.lastIndex;
  }
  return tokens;
}

/**
 * Evalúa una expresión matemática. Lanza un Error con mensaje amable si no se puede.
 * Gramática: expr = term (('+'|'-') term)* ; term = power (('*'|'/') power)* ;
 *            power = unary ('^' power)? ; unary = '-' unary | postfix ; postfix = primary '%'*
 * @param {string} input
 */
export function evaluate(input) {
  if (!input.trim()) throw new Error('Escribe una operación');
  if (input.length > MAX_LENGTH) throw new Error('Esa operación está muy larga');

  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function expr() {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      value = next() === '+' ? value + term() : value - term();
    }
    return value;
  }

  function term() {
    let value = power();
    while (peek() === '*' || peek() === '/') {
      if (next() === '*') {
        value *= power();
      } else {
        const divisor = power();
        if (divisor === 0) throw new Error('No se puede dividir entre cero');
        value /= divisor;
      }
    }
    return value;
  }

  function power() {
    const base = unary();
    if (peek() === '^') {
      next();
      return base ** power();
    }
    return base;
  }

  function unary() {
    if (peek() === '-') {
      next();
      return -unary();
    }
    if (peek() === '+') {
      next();
      return unary();
    }
    return postfix();
  }

  function postfix() {
    let value = primary();
    while (peek() === '%') {
      next();
      value /= 100;
    }
    return value;
  }

  function primary() {
    const token = next();
    if (token === undefined) throw new Error('A la operación le falta algo al final');
    if (token === '(') {
      const value = expr();
      if (next() !== ')') throw new Error('Falta cerrar un paréntesis');
      return value;
    }
    if (/^[\d.]/.test(token)) return Number(token);
    if (token in CONSTANTS) return CONSTANTS[token];
    if (token in FUNCTIONS) {
      if (peek() !== '(') throw new Error(`Usa paréntesis: ${token}(…)`);
      next();
      const arg = expr();
      if (next() !== ')') throw new Error('Falta cerrar un paréntesis');
      if ((token === 'raiz' || token === 'sqrt') && arg < 0) {
        throw new Error('No hay raíz de números negativos (aquí no)');
      }
      return FUNCTIONS[token](arg);
    }
    throw new Error(`No entiendo "${token}"`);
  }

  const result = expr();
  if (pos < tokens.length) throw new Error(`No entiendo "${tokens[pos]}"`);
  if (!Number.isFinite(result)) throw new Error('El resultado es demasiado grande');
  return result;
}

export function formatResult(value) {
  if (Number.isInteger(value)) return value.toLocaleString('es-MX');
  return Number(value.toPrecision(12)).toLocaleString('es-MX', { maximumFractionDigits: 10 });
}

export default {
  name: 'calc',
  aliases: ['calcula', 'calculadora'],
  description: 'Calculadora',
  usage: '!calc <operación> (ej. !calc 2*(3+4)^2, !calc raiz(144), !calc 850*15%)',
  cooldownSeconds: 2,

  async run(ctx) {
    if (!ctx.text) {
      await ctx.reply(`Escribe la operación, ej. ${ctx.bot.prefix}calc 2*(3+4) 🧮`);
      return;
    }
    try {
      const result = evaluate(ctx.text);
      await ctx.reply(`🧮 ${ctx.text} = *${formatResult(result)}*`);
    } catch (err) {
      await ctx.reply(`${err.message} 🤔`);
    }
  },
};
