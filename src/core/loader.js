// Carga los comandos de commands/ (públicos) y private/commands/ (privados).
// - Se ignoran archivos que empiezan con "_".
// - Un comando que falla al cargar se loggea y se omite (no tumba el bot).
// - Nombres/aliases duplicados dentro del mismo grupo → error al arrancar.
// - Un privado con el mismo nombre (o alias) que un público lo reemplaza.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * Valida y normaliza el objeto exportado por un archivo de comando.
 * Lanza un error explicando qué está mal.
 */
export function normalizeCommand(raw, file) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('no exporta un objeto por defecto (export default { ... })');
  }
  const name = typeof raw.name === 'string' ? raw.name.trim().toLowerCase() : '';
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`"name" inválido (${JSON.stringify(raw.name)}): usa letras, números, - o _`);
  }
  if (typeof raw.run !== 'function') {
    throw new Error('falta la función run(ctx)');
  }
  const aliases = raw.aliases ?? [];
  if (!Array.isArray(aliases) || aliases.some((a) => typeof a !== 'string')) {
    throw new Error('"aliases" debe ser un arreglo de textos');
  }
  const normalizedAliases = aliases.map((a) => a.trim().toLowerCase());
  const badAlias = normalizedAliases.find((a) => !NAME_PATTERN.test(a));
  if (badAlias !== undefined) {
    throw new Error(`alias inválido: ${JSON.stringify(badAlias)}`);
  }
  if (raw.cooldownSeconds !== undefined) {
    if (!Number.isFinite(raw.cooldownSeconds) || raw.cooldownSeconds < 0) {
      throw new Error('"cooldownSeconds" debe ser un número >= 0');
    }
  }

  return {
    ...raw,
    name,
    aliases: normalizedAliases,
    description: typeof raw.description === 'string' ? raw.description : '',
    usage: typeof raw.usage === 'string' ? raw.usage : undefined,
    usesAI: Boolean(raw.usesAI),
    groupOnly: Boolean(raw.groupOnly),
    ownerOnly: Boolean(raw.ownerOnly),
    file,
  };
}

/** Lista los .js de una carpeta (sin los que empiezan con "_"). Carpeta inexistente → []. */
async function listCommandFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

/**
 * Importa y valida los comandos de una carpeta.
 * Devuelve un Map nombre-o-alias → comando. Duplicados dentro de la carpeta → error.
 */
async function loadGroup(dir, isPrivate, log) {
  const commands = [];
  for (const file of await listCommandFiles(dir)) {
    const relative = path.relative(process.cwd(), file);
    try {
      const mod = await import(pathToFileURL(file).href);
      commands.push({ ...normalizeCommand(mod.default, relative), isPrivate });
    } catch (err) {
      log.error({ file: relative, err: err.message }, 'No se pudo cargar el comando; se omite');
    }
  }

  const lookup = new Map();
  for (const command of commands) {
    for (const key of [command.name, ...command.aliases]) {
      const existing = lookup.get(key);
      if (existing) {
        const group = isPrivate ? 'privados' : 'públicos';
        throw new Error(
          `"${key}" está repetido en los comandos ${group}: ${existing.file} y ${command.file}`,
        );
      }
      lookup.set(key, command);
    }
  }
  return lookup;
}

/**
 * Carga todos los comandos y devuelve el registro.
 * @param {{ publicDir: string, privateDir: string, log: import('pino').Logger }} options
 */
export async function loadCommands({ publicDir, privateDir, log }) {
  const publicLookup = await loadGroup(publicDir, false, log);
  const privateLookup = await loadGroup(privateDir, true, log);

  const lookup = new Map(publicLookup);
  for (const [key, command] of privateLookup) {
    const replaced = lookup.get(key);
    if (replaced) {
      log.warn(
        { key, public: replaced.file, private: command.file },
        'Un comando privado reemplaza a uno público',
      );
      // El público reemplazado desaparece por completo (con todos sus aliases).
      for (const [k, c] of lookup) {
        if (c === replaced) lookup.delete(k);
      }
    }
  }
  for (const [key, command] of privateLookup) lookup.set(key, command);

  const list = [...new Set(lookup.values())].sort((a, b) => a.name.localeCompare(b.name));
  log.info(
    {
      public: list.filter((c) => !c.isPrivate).length,
      private: list.filter((c) => c.isPrivate).length,
    },
    'Comandos cargados',
  );

  return {
    /** Comandos únicos, ordenados por nombre. */
    list,
    /** Busca por nombre o alias (sin importar mayúsculas). */
    find(nameOrAlias) {
      return lookup.get(nameOrAlias.toLowerCase());
    },
  };
}
