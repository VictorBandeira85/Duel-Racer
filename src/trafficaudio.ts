// Sons do trânsito, do rival e da viatura: o motor de cada carro perto do jogador (até três ao
// mesmo tempo), com posição no estéreo, volume pela distância e efeito Doppler (o tom cai ao
// passar); o "vuuush" do vento numa ultrapassagem rápida e próxima; e as reações dos motoristas:
// buzina desesperada e freada de quem vem na contramão de frente, buzinada de quem foi fechado
// e buzina longa de quem levou uma batida.
import { audioCtx, audioOut, noiseBuffer, synthReady } from './audio';
import { CAR_W, KMH } from './config';
import { perfClass } from './cars';
import { engineSpec, type EngineSpec } from './enginesynth';
import type { Race, TrafficCar } from './race';

const M_LON = KMH / 3.6; // unidades do mundo -> metros (no sentido da pista)
const M_LAT = 1.8 / CAR_W; // e de lado (o carro tem 1,8 m)
const SOUND = 343; // m/s
const RANGE = 70; // m: além disso, nenhum motor de fora

// motor de cada modelo do trânsito
const MODEL_ENGINE: Record<string, string> = { sedan: 'V6', hatch: '4 cil.', pickup: 'V8', van: '4 cil.', truck: 'diesel' };
// buzina de cada tipo de veículo: notas (Hz), timbre, filtro (tipo, frequência, Q), ataque (s)
// e volume. Cada carro ainda tem a sua afinação (até ±9%), então dois iguais não soam idênticos.
interface HornDef { notes: number[]; wave: OscillatorType; filter: BiquadFilterType; fq: number; q: number; attack: number; vol: number; beat: [number, number] }
export const HORN: Record<string, HornDef> = {
  // carro pequeno: "bip" fino e agudo, quase uma nota só
  hatch: { notes: [520, 545], wave: 'square', filter: 'bandpass', fq: 1500, q: 2.2, attack: 0.005, vol: 0.09, beat: [0.2, 0.11] },
  // sedã: as duas notas clássicas (terça maior), cheio
  sedan: { notes: [405, 510], wave: 'square', filter: 'lowpass', fq: 2000, q: 0.9, attack: 0.008, vol: 0.11, beat: [0.34, 0.2] },
  // van: fanhosa, intervalo curto e médios ressaltados
  van: { notes: [350, 395], wave: 'square', filter: 'bandpass', fq: 1100, q: 1.6, attack: 0.01, vol: 0.11, beat: [0.38, 0.24] },
  // picape: grave e metálica, quinta justa
  pickup: { notes: [290, 435], wave: 'sawtooth', filter: 'lowpass', fq: 1500, q: 1.4, attack: 0.012, vol: 0.12, beat: [0.46, 0.3] },
  // caminhão: buzina a ar, acorde de três notas bem grave, entra devagar
  // esportivo (classes B, A e S): duas cornetas brilhantes e rápidas
  sport: { notes: [440, 554], wave: 'sawtooth', filter: 'bandpass', fq: 1800, q: 1.3, attack: 0.006, vol: 0.12, beat: [0.26, 0.15] },
  truck: { notes: [147, 185, 220], wave: 'sawtooth', filter: 'lowpass', fq: 1300, q: 0.8, attack: 0.08, vol: 0.17, beat: [0.85, 0.62] },
};

interface Voice { node: AudioWorkletNode; gain: GainNode; pan: StereoPannerNode; key: object | null; spec: string }
interface Horn { osc: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode; key: object | null; model: string }
interface CarState { prevDz: number; panicT: number; honkCd: number; braked: boolean; hitHonk: boolean }

let voices: Voice[] = [];
let horns: Horn[] = [];
let built = false;
let raceRef: Race | null = null;
let state = new WeakMap<object, CarState>();
let t0 = 0;

function build() {
  const ctx = audioCtx();
  if (!ctx || !synthReady() || built) return;
  built = true;
  for (let i = 0; i < 3; i++) {
    const node = new AudioWorkletNode(ctx, 'engine-synth', { numberOfInputs: 0, outputChannelCount: [1] });
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    node.connect(gain).connect(pan).connect(audioOut());
    voices.push({ node, gain, pan, key: null, spec: '' });
  }
  for (let i = 0; i < 2; i++) {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    const osc = [0, 1, 2].map(() => {
      const o = ctx.createOscillator();
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain).connect(pan).connect(audioOut());
    horns.push({ osc, filter, gain, pan, key: null, model: '' });
  }
}

// afinação própria de cada carro (fixa enquanto ele existir)
const tuning = new WeakMap<object, number>();
function tuneOf(key: object) {
  let t = tuning.get(key);
  if (t === undefined) tuning.set(key, (t = 0.91 + Math.random() * 0.18));
  return t;
}

function st(key: object): CarState {
  let s = state.get(key);
  if (!s) state.set(key, (s = { prevDz: NaN, panicT: 0, honkCd: 0, braked: false, hitHonk: false }));
  return s;
}

// "vuuush": ruído que sobe e cai, do lado por onde o carro passou
function whoosh(pan: number, power: number) {
  const ctx = audioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.7);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(380, t + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * power, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  const p = ctx.createStereoPanner();
  p.pan.setValueAtTime(pan * 0.3, t);
  p.pan.linearRampToValueAtTime(pan, t + 0.5);
  src.connect(f).connect(g).connect(p).connect(audioOut());
  src.start();
}

// pneu cantando numa freada de pânico
function screech(pan: number, power: number) {
  const ctx = audioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.1);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(2300, t);
  f.frequency.linearRampToValueAtTime(1700, t + 1);
  f.Q.value = 7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14 * power, t + 0.05);
  g.gain.setValueAtTime(0.14 * power, t + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  src.connect(f).connect(g).connect(p).connect(audioOut());
  src.start();
}

export function stopTrafficAudio() {
  const ctx = audioCtx();
  if (!ctx) return;
  for (const v of voices) {
    v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    v.key = null;
  }
  for (const h of horns) {
    h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    h.key = null;
  }
}

interface Src { key: object; dz: number; dx: number; d: number; vz: number; spec: string; rpm: number; load: number; vol: number; car?: TrafficCar }

// giro aproximado de quem não tem conta-giros (trânsito): sobe com a velocidade dentro de cada marcha
function rpmFor(kmh: number, top: number, gears = 5) {
  const f = Math.min(1, kmh / top);
  const g = Math.min(gears - 1, Math.floor(f * gears));
  return 0.3 + 0.55 * (f * gears - g);
}

export function updateTrafficAudio(r: Race, dt: number) {
  const ctx = audioCtx();
  if (!ctx) return;
  build();
  if (raceRef !== r) {
    raceRef = r;
    state = new WeakMap();
    stopTrafficAudio();
  }
  t0 += dt;
  const pz = r.playerZ, px = r.x, pv = r.speed;
  const srcs: Src[] = [];
  const add = (key: object, z: number, x: number, speed: number, spec: string, rpm: number, load: number, vol: number, car?: TrafficCar) => {
    const dz = (z - pz) * M_LON, dx = (x - px) * M_LAT;
    const d = Math.hypot(dz, dx, 1);
    srcs.push({ key, dz, dx, d, vz: (speed - pv) * M_LON, spec, rpm, load, vol, car });
  };
  for (const c of r.traffic) {
    const kmh = Math.abs(c.speed) * KMH;
    // modelo do jogo: o ronco dele de verdade
    if (c.car) add(c, c.z, c.x, c.speed, `${c.car.engine}|${c.car.id}`, c.hit ? 0.05 : rpmFor(kmh, c.car.maxSpeed * KMH, c.car.gears.length), c.hit ? 0 : 0.55, 0.95, c);
    else add(c, c.z, c.x, c.speed, MODEL_ENGINE[c.model] ?? 'V6', c.hit ? 0.05 : rpmFor(kmh, c.truck ? 110 : 160, c.truck ? 8 : 5), c.hit ? 0 : 0.55, c.truck ? 1.25 : 0.9, c);
  }
  if (r.rival && r.rivalCar) {
    const kmh = r.rival.speed * KMH;
    add(r.rival, r.rival.z, r.rival.x, r.rival.speed, `${r.rivalCar.engine}|${r.rivalCar.id}`, rpmFor(kmh, r.rivalCar.maxSpeed * KMH, r.rivalCar.gears.length), 1, 1.3);
  }
  for (const p of r.police) if (p.state === 'chase' || p.state === 'pull')
    add(p, p.z, p.x, p.speed, p.sv ? 'V12 48v' : 'V8 16v', rpmFor(p.speed * KMH, p.sv ? 300 : 245, 4), 1, 1.2);

  // ---- motores: os três mais perto ----
  const near = srcs.filter((s) => s.d < RANGE).sort((a, b) => a.d - b.d).slice(0, voices.length);
  for (const v of voices) if (v.key && !near.some((s) => s.key === v.key)) {
    v.key = null;
    v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  }
  for (const s of near) {
    let v = voices.find((q) => q.key === s.key) ?? voices.find((q) => !q.key);
    if (!v) break;
    if (v.key !== s.key) {
      v.key = s.key;
      v.gain.gain.setValueAtTime(0, ctx.currentTime);
    }
    if (v.spec !== s.spec) {
      v.spec = s.spec;
      const [desc, id] = s.spec.split('|');
      v.node.port.postMessage({ spec: engineSpec(desc, id ?? '') as EngineSpec });
    }
    // Doppler: velocidade com que o carro se afasta (+) ou se aproxima (-) do jogador
    const vr = (s.dz * s.vz) / s.d;
    const pitch = Math.max(0.7, Math.min(1.4, SOUND / (SOUND + vr)));
    v.node.port.postMessage({ rpm: s.rpm, load: s.load, on: 1, boost: 0, pitch });
    const g = (0.14 * s.vol) / (1 + (s.d / 6) ** 2);
    v.gain.gain.setTargetAtTime(r.state === 'arrived' ? g * 0.5 : g, ctx.currentTime, 0.05);
    v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (s.dx / s.d) * 1.2)), ctx.currentTime, 0.05);
  }

  // ---- passagens e reações ----
  let hornWant: { key: object; model: string; s: Src; on: boolean }[] = [];
  for (const s of srcs) {
    if (s.d > RANGE) continue;
    const cs = st(s.key);
    cs.honkCd = Math.max(0, cs.honkCd - dt);
    // passou do lado: vento proporcional à velocidade relativa e à proximidade
    if (!Number.isNaN(cs.prevDz) && Math.sign(cs.prevDz) !== Math.sign(s.dz) && Math.abs(s.dx) < 4.5) {
      const rel = Math.abs(s.vz) * 3.6;
      if (rel > 35) whoosh(Math.sign(s.dx) || 0.01, Math.min(1, rel / 220) * (1 - Math.abs(s.dx) / 5));
    }
    cs.prevDz = s.dz;
    const c = s.car;
    if (!c) continue;
    const model = c.truck ? 'truck' : c.car ? ({ D: 'hatch', C: 'sedan' } as Record<string, string>)[perfClass(c.car)] ?? 'sport' : c.model;
    // contramão vindo de frente na faixa do jogador: buzina (e freia em cima)
    if (c.panic > 0) {
      cs.panicT += dt;
      if (c.panic > 1.5 && !cs.braked) {
        cs.braked = true;
        screech(Math.max(-1, Math.min(1, s.dx / 4)), Math.min(1, 0.4 + c.panic * 0.2));
      }
      // desespero: buzina contínua bem perto; antes, toques curtos e nervosos
      const [per, dur] = (HORN[model] ?? HORN.sedan).beat;
      const on = c.panic > 1.5 ? true : (cs.panicT % per) < dur; // ritmo de cada buzina
      hornWant.push({ key: c, model, s, on });
      continue;
    }
    cs.panicT = 0;
    cs.braked = false;
    // bateu: buzina longa, uma vez
    if (c.hit && !cs.hitHonk) {
      cs.hitHonk = true;
      cs.honkCd = 1.4;
    }
    if (c.hit && cs.honkCd > 0) {
      hornWant.push({ key: c, model, s, on: true });
      continue;
    }
    // fechado: o jogador passou e entrou logo à frente dele, mais devagar
    if (c.speed > 0 && s.dz < -1 && s.dz > -9 && Math.abs(s.dx) < 1.3 && s.vz > 2 && cs.honkCd <= 0) cs.honkCd = 6;
    if (c.speed > 0 && cs.honkCd > 6 - 2.2 * (HORN[model] ?? HORN.sedan).beat[0]) {
      const [per, dur] = (HORN[model] ?? HORN.sedan).beat;
      hornWant.push({ key: c, model, s, on: (6 - cs.honkCd) % per < dur });
    }
  }
  hornWant = hornWant.sort((a, b) => a.s.d - b.s.d).slice(0, horns.length);
  for (const h of horns) if (h.key && !hornWant.some((w) => w.key === h.key)) {
    h.key = null;
    h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  }
  for (const w of hornWant) {
    const h = horns.find((q) => q.key === w.key) ?? horns.find((q) => !q.key);
    if (!h) break;
    h.key = w.key;
    const def = HORN[w.model] ?? HORN.sedan;
    if (h.model !== w.model) {
      h.model = w.model;
      h.osc.forEach((o) => (o.type = def.wave));
      h.filter.type = def.filter;
      h.filter.frequency.value = def.fq;
      h.filter.Q.value = def.q;
    }
    const vr = (w.s.dz * w.s.vz) / w.s.d;
    const pitch = Math.max(0.7, Math.min(1.4, SOUND / (SOUND + vr))) * tuneOf(w.key);
    h.osc.forEach((o, i) => {
      const n = def.notes[i];
      o.frequency.setTargetAtTime((n ?? def.notes[0] * 1.006) * pitch, ctx.currentTime, 0.02); // 2 notas: a 3ª desafina a 1ª de leve (corneta dupla)
    });
    // buzina se ouve de longe (o pânico começa ~3 s antes, ainda a dezenas de metros);
    // as fanhosas (filtro de banda) perdem volume no filtro e são compensadas
    const g = (def.vol * 2.4 * (def.filter === 'bandpass' ? 1.7 : 1) * (def.notes.length === 3 ? 0.8 : 1)) / (1 + (w.s.d / 45) ** 2);
    h.gain.gain.setTargetAtTime(w.on ? g : 0, ctx.currentTime, w.on ? def.attack : 0.015);
    h.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (w.s.dx / w.s.d) * 1.2)), ctx.currentTime, 0.03);
  }
}
