// Gravação leve da corrida para o REPLAY dos melhores momentos: a cada 0,1 s, a posição do jogador,
// do rival, dos figurantes e do trânsito por perto (até 4.000 amostras, ~6,5 min: o resto mais velho
// sai). Os lances são marcados sozinhos durante a corrida: ultrapassagem no rival, salto, quase
// batida, batida, fuga da polícia e a chegada. No fim, os melhores (sem sobrepor) viram os clipes.
import { CAR_W, SEG_LEN } from './config';
import type { CarSpec } from './cars';
import type { Plate } from './plates';
import type { Race, TrafficModel } from './race';
import { paintHex } from './paint';

export const REC_DT = 0.1;
const MAX_FRAMES = 4000;
const AHEAD = 140 * SEG_LEN, BEHIND = 25 * SEG_LEN; // trânsito guardado: só o que a câmera de trás pode ver

export interface Frame {
  t: number;
  z: number; x: number; lift: number; brake: boolean; kmh: number;
  nightK: number; rainK: number; bg: number; tunnel: number;
  rz: number; rx: number; // rival (NaN sem rival)
  ex: number[]; // figurantes: z, x, z, x...
  tr: Float32Array; // trânsito: índice, z, x, tilt (4 por carro)
}
export interface TrafficLook { t: number; model: TrafficModel; color: string; truck: boolean; car?: CarSpec; plate?: Plate; base: number }
export type MomentKind = 'pass' | 'jump' | 'near' | 'crash' | 'escape' | 'finish' | 'lost';
export interface Moment { kind: MomentKind; t: number; label: string; score: number }
export interface Clip { t0: number; t1: number; label: string; kind: MomentKind; slow: boolean }

export interface Recording {
  race: Race;
  car: CarSpec;
  paint?: string;
  frames: Frame[];
  looks: Map<number, TrafficLook[]>;
  moments: Moment[];
  clock: number;
  next: number;
  // memória entre amostras (para marcar os lances)
  relRival: number;
  relEx: number[];
  airT: number; airFrom: number;
  near: number; escapes: number; state: string;
  done: boolean;
}

let rec: Recording | null = null;
export const recording = () => rec;

function start(r: Race): Recording {
  return {
    race: r, car: r.car, paint: paintHex(r.car.id), frames: [], looks: new Map(), moments: [], clock: 0, next: 0,
    relRival: 0, relEx: [], airT: 0, airFrom: 0, near: r.stats.near, escapes: r.escapes, state: r.state, done: false,
  };
}

// chamado a cada passo da física (main.ts)
export function recTick(r: Race, dt: number) {
  if (!rec || rec.race !== r) rec = start(r);
  if (rec.done) return;
  if (r.state === 'countdown') return;
  rec.clock += dt;
  if (rec.clock < rec.next) return;
  rec.next = rec.clock + REC_DT;
  sample(rec, r);
}
// fim do trecho (main.ts, onArrive): fecha a gravação
export function recDone(r: Race) {
  if (rec?.race === r) {
    sample(rec, r);
    rec.done = true;
  }
}

function sample(R: Recording, r: Race) {
  const t = R.clock;
  const pz = r.playerZ;
  const tr: number[] = [];
  r.traffic.forEach((c, i) => {
    if (c.z < pz - BEHIND || c.z > pz + AHEAD) return;
    tr.push(i, c.z, c.x, c.tilt || 0);
    // aparência: guardada só quando muda (o carro do trânsito é reaproveitado mais à frente)
    let l = R.looks.get(i);
    if (!l) R.looks.set(i, (l = []));
    const last = l[l.length - 1];
    if (!last || last.model !== c.model || last.color !== c.color || last.car !== c.car || Math.sign(last.base) !== Math.sign(c.base)) {
      l.push({ t, model: c.model, color: c.color, truck: c.truck, car: c.car, plate: c.plate, base: c.base });
    }
  });
  const ex: number[] = [];
  for (const e of r.extras) ex.push(e.r.z, e.r.x);
  R.frames.push({
    t, z: pz, x: r.x, lift: r.lift, brake: r.braking, kmh: r.speed * 0.025,
    nightK: r.nightK, rainK: r.rainK, bg: r.bgOffset, tunnel: r.inTunnel,
    rz: r.rival ? r.rival.z : NaN, rx: r.rival ? r.rival.x : NaN, ex, tr: Float32Array.from(tr),
  });
  if (R.frames.length > MAX_FRAMES) {
    R.frames.splice(0, 600);
    const t0 = R.frames[0].t;
    R.moments = R.moments.filter((m) => m.t > t0 + 3);
  }
  // ---- lances ----
  const drive = r.state === 'drive';
  if (r.rival) {
    const rel = Math.sign(pz - r.rival.z - CAR_W * 0.2);
    if (drive && R.relRival < 0 && rel > 0) R.moments.push({ kind: 'pass', t, label: 'ULTRAPASSAGEM NO RIVAL', score: 80 });
    if (drive && R.relRival > 0 && rel < 0 && Math.abs(pz - r.rival.z) < SEG_LEN * 3) R.moments.push({ kind: 'lost', t, label: 'O RIVAL PASSOU', score: 35 });
    if (rel) R.relRival = rel;
  }
  r.extras.forEach((e, k) => {
    const rel = Math.sign(pz - e.r.z);
    if (drive && (R.relEx[k] ?? 0) < 0 && rel > 0) R.moments.push({ kind: 'pass', t, label: `PASSOU ${e.name.toUpperCase()}`, score: 55 });
    if (rel) R.relEx[k] = rel;
  });
  if (r.airborne) {
    if (!R.airT) R.airFrom = t;
    R.airT += REC_DT;
  } else if (R.airT) {
    if (R.airT >= 0.35) {
      const s = R.airT.toFixed(1).replace('.', ',');
      R.moments.push({ kind: 'jump', t: R.airFrom + R.airT / 2, label: `SALTO DE ${s} s`, score: 55 + R.airT * 25 });
    }
    R.airT = 0;
  }
  if (r.stats.near > R.near) R.moments.push({ kind: 'near', t, label: 'POR UM TRIZ!', score: 50 });
  R.near = r.stats.near;
  if (r.escapes > R.escapes) R.moments.push({ kind: 'escape', t, label: 'DESPISTOU A POLÍCIA', score: 70 });
  R.escapes = r.escapes;
  if (r.state !== R.state) {
    if (r.state === 'crash') R.moments.push({ kind: 'crash', t, label: 'BATIDA!', score: 40 });
    if (r.state === 'arrived') R.moments.push({ kind: 'finish', t, label: 'CHEGADA', score: 100 });
    R.state = r.state;
  }
}

const WIN: Record<MomentKind, [number, number]> = {
  pass: [3.5, 2], lost: [3, 1.5], jump: [2.5, 2.5], near: [2.5, 1.5], crash: [2, 3], escape: [3, 2], finish: [4, 2.5],
};
// os melhores lances (até 5, sem sobrepor), em ordem de tempo
export function clips(R: Recording | null = rec): Clip[] {
  if (!R || R.frames.length < 20) return [];
  const f0 = R.frames[0].t, f1 = R.frames[R.frames.length - 1].t;
  const picked: Clip[] = [];
  const ms = [...R.moments].sort((a, b) => b.score - a.score);
  for (const m of ms) {
    if (picked.length >= 5) break;
    const [a, b] = WIN[m.kind];
    const t0 = Math.max(f0, m.t - a), t1 = Math.min(f1, m.t + b);
    if (t1 - t0 < 1) continue;
    // lances colados viram um clipe só (até 10 s), com os dois nomes
    const hit = picked.find((p) => t0 < p.t1 && t1 > p.t0);
    if (hit) {
      const u0 = Math.min(hit.t0, t0), u1 = Math.max(hit.t1, t1);
      if (u1 - u0 <= 10 && !hit.label.includes(m.label)) Object.assign(hit, { t0: u0, t1: u1, label: m.t < hit.t0 ? `${m.label} + ${hit.label}` : `${hit.label} + ${m.label}`, slow: false });
      continue;
    }
    picked.push({ t0, t1, label: m.label, kind: m.kind, slow: m.kind === 'jump' || m.kind === 'near' });
  }
  return picked.sort((a, b) => a.t0 - b.t0);
}
export const replayReady = (r?: Race | null) => !!rec && rec.done && (!r || rec.race === r) && clips().length > 0;

// quadro no instante t (interpolado entre as amostras)
export function frameAt(R: Recording, t: number): { a: Frame; b: Frame; u: number } {
  const fs = R.frames;
  let lo = 0, hi = fs.length - 1;
  if (t <= fs[0].t) return { a: fs[0], b: fs[0], u: 0 };
  if (t >= fs[hi].t) return { a: fs[hi], b: fs[hi], u: 0 };
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (fs[m].t <= t) lo = m;
    else hi = m;
  }
  const a = fs[lo], b = fs[hi];
  return { a, b, u: (t - a.t) / Math.max(1e-6, b.t - a.t) };
}
export function lookAt(R: Recording, i: number, t: number): TrafficLook | undefined {
  const l = R.looks.get(i);
  if (!l) return undefined;
  let k = l.length - 1;
  while (k > 0 && l[k].t > t + 1e-6) k--;
  return l[k];
}
