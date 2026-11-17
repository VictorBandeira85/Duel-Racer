// Preparação do Arcade: as peças que o jogador instala na OFICINA do Arcade, por carro, de graça e
// separadas da carreira (chave própria no aparelho). Na corrida do Arcade (CORRER) o carro entra com
// elas, pelo mesmo applyBuild da carreira (potência, máxima, aderência, ronco, rodas, altura, turbo).
import { CARS, type CarSpec } from './cars';
import { DEFAULT_SETUP, tunedCar } from './career';
import { buildKey, type Build, type SlotId } from './tuning';
import { isObj } from './util';
import { arcadeGearing, gearingKey, reloadArcadeGearing } from './gearbox';

const KEY = 'duel-racer:arcade-preparacao';
let builds: Record<string, Build> | null = null;

// save estragado ou de outra versão: o que não for "carro -> { vaga: id da peça }" sai (a vaga volta à
// original); id de peça desconhecido já cai na original em partOf; carro que saiu do jogo deixa de contar
export function loadArcadeBuilds(): Record<string, Build> {
  const out: Record<string, Build> = {};
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (isObj(v)) {
      for (const [id, b] of Object.entries(v)) {
        if (!isObj(b) || !CARS.some((c) => c.id === id)) continue;
        const ok: Build = {};
        for (const [k, p] of Object.entries(b)) if (typeof p === 'string' && p) ok[k as SlotId] = p;
        if (buildKey(ok)) out[id] = ok;
      }
    }
  } catch {
    /* JSON quebrado ou sem armazenamento: Arcade de fábrica */
  }
  return out;
}
const all = () => (builds ??= loadArcadeBuilds());

export const arcadeBuildOf = (id: string): Build => all()[id] ?? {};
export const arcadePrepped = (id: string) => !!buildKey(arcadeBuildOf(id)) || !!gearingKey(arcadeGearing(id)); // (câmbio ajustado também conta)

export function setArcadePart(id: string, slot: SlotId, part: string) {
  const b: Build = { ...arcadeBuildOf(id), [slot]: part };
  if (!part) delete b[slot];
  const m = all();
  if (buildKey(b)) m[id] = b;
  else delete m[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

// carro do Arcade com as peças (guardado por montagem: a ficha e o índice de desempenho são medidos uma vez)
const cache = new Map<string, CarSpec>();
export function arcadeTuned(car: CarSpec, build: Build = arcadeBuildOf(car.id)): CarSpec {
  const k = buildKey(build), g = arcadeGearing(car.id), gk = gearingKey(g); // câmbio do Arcade (gearbox.ts)
  if (!k && !gk) return car;
  const key = `${car.id}|${k}|${gk}`;
  let t = cache.get(key);
  if (!t) cache.set(key, (t = tunedCar(car, undefined, { ...DEFAULT_SETUP, ...g }, build)));
  return t;
}

// para testes (save trocado por fora): relê do aparelho
export function reloadArcadeBuilds() {
  builds = null;
  reloadArcadeGearing();
  cache.clear();
}
