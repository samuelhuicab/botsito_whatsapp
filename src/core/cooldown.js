// Cooldowns en memoria: "¿ya pasó el tiempo desde la última vez que X hizo Y?".

const SWEEP_THRESHOLD = 1000;

export function createCooldowns({ now = () => Date.now() } = {}) {
  /** key → timestamp (ms) en que se vuelve a permitir */
  const until = new Map();

  function sweep(current) {
    for (const [key, time] of until) {
      if (time <= current) until.delete(key);
    }
  }

  return {
    /**
     * Si la key está libre, la bloquea `seconds` segundos y devuelve 0.
     * Si sigue bloqueada, devuelve los segundos que faltan (redondeados hacia arriba).
     * @param {string} key
     * @param {number} seconds
     */
    hit(key, seconds) {
      if (!seconds || seconds <= 0) return 0;
      const current = now();
      const blockedUntil = until.get(key);
      if (blockedUntil && blockedUntil > current) {
        return Math.ceil((blockedUntil - current) / 1000);
      }
      if (until.size >= SWEEP_THRESHOLD) sweep(current);
      until.set(key, current + seconds * 1000);
      return 0;
    },

    /** Cuántas keys hay guardadas (para tests). */
    get size() {
      return until.size;
    },
  };
}
