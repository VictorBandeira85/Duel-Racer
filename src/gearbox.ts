// Câmbio da oficina: cada marcha mais curta ou mais longa (em passos de 3%) e o diferencial final
// (também em passos de 3%, mexe em todas). A física usa as relações de verdade: car.gears é a
// velocidade de cada marcha no corte (fração da máxima de ficha), então marcha mais curta = mais força
// na roda e corte mais cedo; diferencial longo = menos giro na estrada (a máxima só sobe se o motor
// tiver fôlego) e curto = arranca mais e bate no corte antes da máxima.
// Salvo por carro: na carreira no ajuste da oficina (Setup.gears/final, career.ts) e no Arcade numa
// chave própria do aparelho (arcadeGearing). Valores fora da regra voltam ao original (cleanGearing).
import { CARS, LAUNCH_BOOST, Powertrain, resistAcc, toGame, type CarSpec } from './cars';
import { KMH } from './config';
import { isObj } from './util';

export interface Gearing { gears?: number[]; final?: number }
export const STEP = 0.03; // cada passo: 3% mais longa (+) ou mais curta (-)
export const MAX_STEP = 5; // até ±15% por marcha e no diferencial
const MIN_GAP = 1.08; // cada marcha pelo menos 8% mais longa que a anterior

const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-MAX_STEP, Math.min(MAX_STEP, Math.round(v))) : 0);
/** relações (velocidade no corte, fração da máxima) com os passos aplicados */
export function gearsWith(base: number[], g: Gearing | undefined): number[] {
  const f = 1 + STEP * int(g?.final);
  return base.map((v, i) => v * (1 + STEP * int(g?.gears?.[i])) * f);
}
/** a regra: marchas em ordem, cada uma ao menos 8% mais longa que a anterior */
export function gearingOk(base: number[], g: Gearing): boolean {
  const r = gearsWith(base, g);
  return r.every((v, i) => i === 0 || v >= r[i - 1] * MIN_GAP);
}
/** ajuste vindo do save (ou do aparelho): números inteiros dentro da faixa, do tamanho do câmbio do
 * carro e dentro da regra; senão volta ao original. Vazio (tudo 0) = undefined */
export function cleanGearing(car: CarSpec, v: unknown): Gearing | undefined {
  if (!isObj(v)) return undefined;
  const o = v as Record<string, unknown>;
  const gears = car.gears.map((_, i) => int(Array.isArray(o.gears) ? o.gears[i] : 0));
  const g: Gearing = { gears, final: int(o.final) };
  if (!gearingOk(car.gears, g)) return undefined;
  return isStock(g) ? undefined : g;
}
export const isStock = (g: Gearing | undefined) => !g || (!int(g.final) && !(g.gears ?? []).some((x) => int(x)));
export const gearingKey = (g: Gearing | undefined) => (isStock(g) ? '' : `${(g!.gears ?? []).map(int).join('.')}/${int(g!.final)}`);

/** um passo numa marcha (i) ou no diferencial (i = -1); devolve o ajuste novo ou o motivo de não poder */
export function stepGearing(car: CarSpec, g: Gearing, i: number, d: number): Gearing | string {
  const gears = car.gears.map((_, k) => int(g.gears?.[k]));
  let final = int(g.final);
  if (i < 0) final += d;
  else gears[i] += d;
  if (Math.abs(i < 0 ? final : gears[i]) > MAX_STEP) return d > 0 ? 'Já está no mais longo' : 'Já está no mais curto';
  const n: Gearing = { gears, final };
  if (!gearingOk(car.gears, n)) {
    const r = gearsWith(car.gears, n);
    const bad = r.findIndex((v, k) => k > 0 && v < r[k - 1] * MIN_GAP);
    return `A ${bad + 1}ª tem de ficar mais longa que a ${bad}ª`;
  }
  return n;
}

// ---------- medições na física (as mesmas da corrida) ----------
/** pé no fundo desde parado, trocando no automático: tempos até 100 e 160 km/h e a máxima alcançada */
export function runUp(car: CarSpec, secs = 90) {
  const pt = new Powertrain(car);
  pt.boost = LAUNCH_BOOST;
  const dt = 1 / 60;
  let v = 0, t100 = 0, t160 = 0, top = 0, still = 0;
  for (let i = 1; i <= secs * 60; i++) {
    const nv = v + toGame(pt.step(v, true, dt) - resistAcc(car, v)) * dt;
    if (nv - v < 0.0004 * car.maxSpeed * dt && v > car.maxSpeed * 0.5) still += dt;
    else still = 0;
    v = nv;
    top = Math.max(top, v);
    if (!t100 && v * KMH >= 100) t100 = i * dt;
    if (!t160 && v * KMH >= 160) t160 = i * dt;
    if (still > 2) break; // parou de ganhar velocidade: é a máxima
  }
  return { t100, t160, top };
}
const runCache = new WeakMap<CarSpec, ReturnType<typeof runUp>>();
export const runOf = (car: CarSpec) => {
  let r = runCache.get(car);
  if (!r) runCache.set(car, (r = runUp(car)));
  return r;
};
/** máxima de verdade com o câmbio ajustado (km/h): a da ficha vezes o quanto a física ganha ou perde
 * com as relações novas (com as originais a física dá a da ficha) */
export function realTop(car: CarSpec, factoryGears?: number[]) {
  if (!factoryGears || factoryGears.every((v, i) => Math.abs(v - car.gears[i]) < 1e-9)) return car.maxSpeed * KMH;
  const ref = runOf({ ...car, gears: factoryGears }).top;
  return (car.maxSpeed * KMH * runOf(car).top) / Math.max(1e-6, ref);
}
// ---------- Arcade: câmbio por carro, guardado no aparelho ----------
const KEY = 'duel-racer:arcade-cambio';
let arc: Record<string, Gearing> | null = null;
function arcAll(): Record<string, Gearing> {
  if (arc) return arc;
  arc = {};
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (isObj(v)) for (const [id, g] of Object.entries(v as Record<string, unknown>)) {
      const car = CARS.find((c) => c.id === id);
      const ok = car && cleanGearing(car, g);
      if (ok) arc[id] = ok;
    }
  } catch {
    /* JSON quebrado ou sem armazenamento: câmbio original */
  }
  return arc;
}
export const arcadeGearing = (id: string): Gearing | undefined => arcAll()[id];
export function setArcadeGearing(id: string, g: Gearing | undefined) {
  const m = arcAll();
  const car = CARS.find((c) => c.id === id);
  const ok = car && cleanGearing(car, g);
  if (ok) m[id] = ok;
  else delete m[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
export function reloadArcadeGearing() {
  arc = null;
}
