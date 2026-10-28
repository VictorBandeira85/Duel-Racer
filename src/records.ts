// Recordes e fantasma, guardados no aparelho.
// Recorde: o melhor tempo de cada trecho com cada carro. Fantasma: a melhor passagem de cada
// trecho (com qualquer carro), gravada como a posição na pista a cada décimo de segundo, que
// volta transparente nas próximas tentativas para você disputar com ela.
import type { Race } from './race';

const KEY_T = 'duel-racer:recordes';
const KEY_G = 'duel-racer:fantasmas';
const KEY_ON = 'duel-racer:fantasma';
const MAX_GHOSTS = 60;
export const GHOST_DT = 0.1;

export interface Ghost {
  car: string; // id do carro
  paint?: string;
  time: number; // tempo do trecho (s)
  at: number; // quando foi gravado (para descartar os mais velhos)
  z: number[]; // posição ao longo da pista a cada GHOST_DT
  x: number[]; // posição lateral
}

const read = <T>(key: string, empty: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : empty;
  } catch {
    return empty;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch { /* sem espaço ou sem armazenamento: vale só nesta sessão */ }
};

export const stageKey = (course: string, stage: number) => `${course}:${stage}`;

export function ghostOn() {
  return read(KEY_ON, true);
}
export function setGhostOn(on: boolean) {
  write(KEY_ON, on);
}

export function bestTime(course: string, stage: number, car: string): number | undefined {
  return read<Record<string, number>>(KEY_T, {})[`${stageKey(course, stage)}:${car}`];
}

export function loadGhost(course: string, stage: number): Ghost | null {
  if (!ghostOn()) return null;
  return read<Record<string, Ghost>>(KEY_G, {})[stageKey(course, stage)] ?? null;
}

// Fim do trecho: grava o recorde do carro e, se for a melhor passagem do trecho, o fantasma.
// Devolve o recorde anterior (do carro) e se este tempo é novo recorde.
export function saveRun(r: Race, course: string, stage: number, paint?: string): { prev?: number; record: boolean; ghost: boolean } {
  const times = read<Record<string, number>>(KEY_T, {});
  const k = `${stageKey(course, stage)}:${r.car.id}`;
  const prev = times[k];
  const record = prev === undefined || r.time < prev;
  if (record) {
    times[k] = r.time;
    write(KEY_T, times);
  }
  const ghosts = read<Record<string, Ghost>>(KEY_G, {});
  const gk = stageKey(course, stage);
  const old = ghosts[gk];
  const better = !old || r.time < old.time;
  if (better && r.trace.z.length > 10) {
    ghosts[gk] = { car: r.car.id, paint, time: r.time, at: Date.now(), z: r.trace.z, x: r.trace.x };
    const keys = Object.keys(ghosts);
    if (keys.length > MAX_GHOSTS) {
      keys.sort((a, b) => ghosts[a].at - ghosts[b].at);
      for (const kk of keys.slice(0, keys.length - MAX_GHOSTS)) delete ghosts[kk];
    }
    write(KEY_G, ghosts);
  }
  return { prev, record, ghost: better };
}

// posição do fantasma no instante t (interpolada entre as amostras); null depois que chegou
export function ghostAt(g: Ghost, t: number): { z: number; x: number } | null {
  const f = t / GHOST_DT;
  const i = Math.floor(f);
  if (i < 0 || i >= g.z.length - 1) return null;
  const u = f - i;
  return { z: g.z[i] + (g.z[i + 1] - g.z[i]) * u, x: g.x[i] + (g.x[i + 1] - g.x[i]) * u };
}

// em que instante o fantasma passou por z (para mostrar a diferença de tempo)
export function ghostTimeAt(g: Ghost, z: number): number | null {
  const a = g.z;
  if (!a.length || z < a[0] || z > a[a.length - 1]) return null;
  let lo = 0, hi = a.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (a[m] < z) lo = m;
    else hi = m;
  }
  const span = a[hi] - a[lo];
  return (lo + (span > 0 ? (z - a[lo]) / span : 0)) * GHOST_DT;
}
