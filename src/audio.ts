import { engineSpec, WORKLET, type EngineSpec } from './enginesynth';

// Som sintetizado (sem arquivos de áudio): motor com timbre por tipo de motor, turbo,
// troca de marcha, pneu cantando, batida, sirene e trilha no estilo dos 16 bits.
let ctx: AudioContext | null = null;
let master: GainNode;
let muted = false;
let musicOn = true;

// ---------- motor ----------
// O ronco principal é sintetizado por cilindro (enginesynth.ts, AudioWorklet); os osciladores
// abaixo ficam de reserva para navegadores sem AudioWorklet.
interface EngineProfile { cyl: number; sub: number; rasp: number; bright: number; turbo: boolean }
const PROFILES: Record<string, EngineProfile> = {
  v8: { cyl: 8, sub: 0.9, rasp: 0.12, bright: 0.8, turbo: false },
  v8turbo: { cyl: 8, sub: 0.7, rasp: 0.2, bright: 0.9, turbo: true },
  v12: { cyl: 12, sub: 0.35, rasp: 0.05, bright: 1.3, turbo: false },
  flat12: { cyl: 12, sub: 0.5, rasp: 0.18, bright: 1.1, turbo: false },
  flat6turbo: { cyl: 6, sub: 0.6, rasp: 0.35, bright: 1, turbo: true },
  v6: { cyl: 6, sub: 0.5, rasp: 0.2, bright: 1.1, turbo: false },
  v10: { cyl: 10, sub: 0.85, rasp: 0.3, bright: 0.85, turbo: false },
};

// tipo de motor a partir da ficha do carro ("V8 biturbo", "Boxer 6 biturbo", "V12 48v"...)
export function engineKind(desc: string): string {
  const d = desc.toLowerCase();
  const turbo = d.includes('turbo');
  if (d.includes('v12')) return 'v12';
  if (d.includes('12') && (d.includes('boxer') || d.includes('cil'))) return 'flat12';
  if (d.includes('boxer') || d.includes('6 ')) return turbo ? 'flat6turbo' : 'v6';
  if (d.includes('v10')) return 'v10';
  if (d.includes('v6')) return 'v6';
  return turbo ? 'v8turbo' : 'v8';
}

let prof = PROFILES.v8;
let osc1: OscillatorNode, osc2: OscillatorNode, subGain: GainNode, filter: BiquadFilterNode, gain: GainNode;
let raspGain: GainNode, raspFilter: BiquadFilterNode;
let turbo: OscillatorNode, turboGain: GainNode;
let rumbleGain: GainNode;
// pneus: seco = guincho alto e definido (borracha vibrando em frequências bem marcadas, com
// trepidação); molhado = chiado largo de água sendo espirrada, sem tom; neve = esmagado granulado
let dryGain: GainNode, wetGain: GainNode, snowGain: GainNode, sprayGain: GainNode;
let dryBands: BiquadFilterNode[] = [];
let dryLfo: OscillatorNode;
let shiftDip = 0;
let synth: AudioWorkletNode | null = null;
let synthGain: GainNode;
let spec: EngineSpec = engineSpec('V8');
let lastBoost = 0, lastThrottle = false;

// acesso para os sons do trânsito (trafficaudio.ts)
export const audioCtx = () => ctx;
export const audioOut = () => master;
export const synthReady = () => !!synth;
export function noiseBuffer(seconds: number) {
  const len = Math.floor(ctx!.sampleRate * seconds);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise() {
  const src = ctx!.createBufferSource();
  src.buffer = noiseBuffer(1.5);
  src.loop = true;
  src.start();
  return src;
}

export function initAudio() {
  if (ctx) {
    ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  // motor: dente de serra no ritmo das explosões + onda quadrada uma oitava abaixo (ronco)
  osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2 = ctx.createOscillator();
  osc2.type = 'square';
  subGain = ctx.createGain();
  filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.5;
  gain = ctx.createGain();
  gain.gain.value = 0;
  osc1.connect(filter);
  osc2.connect(subGain).connect(filter);
  // aspereza: ruído filtrado que acompanha o giro
  raspFilter = ctx.createBiquadFilter();
  raspFilter.type = 'bandpass';
  raspFilter.Q.value = 2;
  raspGain = ctx.createGain();
  loopNoise().connect(raspFilter).connect(raspGain).connect(filter);
  filter.connect(gain).connect(master);
  // assobio do turbo
  turbo = ctx.createOscillator();
  turbo.type = 'sine';
  turboGain = ctx.createGain();
  turboGain.gain.value = 0;
  turbo.connect(turboGain).connect(master);
  osc1.start();
  osc2.start();
  turbo.start();

  // pneus: três vozes, uma por piso (seco, molhado, neve), e o chiado da pista molhada
  buildTires();
  const rf = ctx.createBiquadFilter();
  rf.type = 'lowpass';
  rf.frequency.value = 160;
  rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;
  loopNoise().connect(rf).connect(rumbleGain).connect(master);
  if (pendingMusic) startMusic(pendingMusic);

  // ronco por cilindro (quando o navegador tem AudioWorklet)
  synthGain = ctx.createGain();
  synthGain.gain.value = 0.1;
  synthGain.connect(master);
  if (ctx.audioWorklet) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    ctx.audioWorklet.addModule(url).then(() => {
      synth = new AudioWorkletNode(ctx!, 'engine-synth', { numberOfInputs: 0, outputChannelCount: [1] });
      synth.connect(synthGain);
      synth.port.postMessage({ spec });
    }).catch(() => { synth = null; });
  }
}

export function setEngineProfile(desc: string, carId = '') {
  prof = PROFILES[engineKind(desc)] ?? PROFILES.v8;
  spec = engineSpec(desc, carId);
  synth?.port.postMessage({ spec });
}

export function setEngine(rpm: number, throttle: boolean, on: boolean, boost = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const r = Math.max(0, Math.min(1.1, rpm));
  if (synth) {
    const dip = shiftDip > t;
    synth.port.postMessage({ rpm: r, load: throttle && !dip ? 1 : 0, on: on ? 1 : 0, boost });
    gain.gain.setTargetAtTime(0, t, 0.04);
    // turbo: assobio que acompanha a pressão; ao tirar o pé com pressão alta, a válvula de alívio chia
    const tb = spec.turbo && on ? boost * (throttle ? 1 : 0.25) : 0;
    turbo.frequency.setTargetAtTime(2200 + boost * 2600 + r * 900, t, 0.08);
    turboGain.gain.setTargetAtTime(tb * 0.018, t, 0.1);
    if (spec.turbo && on && lastThrottle && !throttle && lastBoost > 0.45) blowOff(lastBoost);
    lastBoost = boost;
    lastThrottle = throttle;
    return;
  }
  const rpmReal = 850 + r * 6600;
  // frequência das explosões, meia oitava abaixo para soar encorpado no estilo 16 bits
  const f = (rpmReal / 60) * (prof.cyl / 2) * 0.5;
  osc1.frequency.setTargetAtTime(f, t, 0.03);
  osc2.frequency.setTargetAtTime(f / 2, t, 0.03);
  subGain.gain.setTargetAtTime(prof.sub * 0.8, t, 0.05);
  raspFilter.frequency.setTargetAtTime(f * 3, t, 0.05);
  raspGain.gain.setTargetAtTime(prof.rasp * (throttle ? 1 : 0.4), t, 0.05);
  filter.frequency.setTargetAtTime((350 + r * 1300 + (throttle ? 450 : 0)) * prof.bright, t, 0.05);
  const dip = shiftDip > t ? 0.35 : 1;
  gain.gain.setTargetAtTime(on ? (throttle ? 0.085 : 0.05) * dip : 0, t, 0.04);
  const tb = prof.turbo && on && throttle ? Math.max(0, r - 0.45) * 0.022 : 0;
  turbo.frequency.setTargetAtTime(1800 + r * 2600, t, 0.08);
  turboGain.gain.setTargetAtTime(tb, t, 0.15);
}

// válvula de alívio do turbo: "tssss" curto
function blowOff(p: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.5);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * p, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  src.connect(f).connect(g).connect(master);
  src.start();
}

// troca de marcha: o ronco cai um instante e há um "clunk" curto
export function shiftSound() {
  if (!ctx) return;
  shiftDip = ctx.currentTime + 0.09;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.06);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.value = 0.12;
  src.connect(f).connect(g).connect(master);
  src.start();
}

function buildTires() {
  const c = ctx!;
  // seco: ruído em três faixas estreitas (fundamental e harmônicos) = guincho com tom
  dryGain = c.createGain();
  dryGain.gain.value = 0;
  const chatter = c.createGain(); // trepidação da borracha (~20 vezes por segundo)
  chatter.gain.value = 0.75;
  dryLfo = c.createOscillator();
  dryLfo.frequency.value = 21;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.25;
  dryLfo.connect(lfoDepth).connect(chatter.gain);
  dryLfo.start();
  const n1 = loopNoise();
  dryBands = [[1, 22, 1], [2.02, 18, 0.55], [3.1, 14, 0.3]].map(([m, q, g]) => {
    const b = c.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = 1050 * m;
    b.Q.value = q;
    const bg = c.createGain();
    bg.gain.value = g * 7; // faixa estreita perde muito volume
    n1.connect(b).connect(bg).connect(chatter);
    return b;
  });
  chatter.connect(dryGain).connect(master);
  // molhado: chiado largo
  wetGain = c.createGain();
  wetGain.gain.value = 0;
  const wh = c.createBiquadFilter();
  wh.type = 'highpass';
  wh.frequency.value = 700;
  const wl = c.createBiquadFilter();
  wl.type = 'lowpass';
  wl.frequency.value = 4200;
  const wb = c.createBiquadFilter();
  wb.type = 'peaking';
  wb.frequency.value = 1600;
  wb.gain.value = 6;
  loopNoise().connect(wh).connect(wl).connect(wb).connect(wetGain).connect(master);
  // neve: grave e granulado (ruído modulado por ruído lento)
  snowGain = c.createGain();
  snowGain.gain.value = 0;
  const sb = c.createBiquadFilter();
  sb.type = 'bandpass';
  sb.frequency.value = 650;
  sb.Q.value = 0.9;
  const grain = c.createGain();
  grain.gain.value = 0.5;
  const gl = c.createBiquadFilter();
  gl.type = 'lowpass';
  gl.frequency.value = 35;
  const gd = c.createGain();
  gd.gain.value = 6;
  loopNoise().connect(gl).connect(gd).connect(grain.gain);
  loopNoise().connect(sb).connect(grain).connect(snowGain).connect(master);
  // pista molhada: chiado dos pneus na água, cresce com a velocidade
  sprayGain = c.createGain();
  sprayGain.gain.value = 0;
  const sh = c.createBiquadFilter();
  sh.type = 'bandpass';
  sh.frequency.value = 2600;
  sh.Q.value = 0.6;
  loopNoise().connect(sh).connect(sprayGain).connect(master);
}

export type Surface = 'dry' | 'wet' | 'snow';
// screech 0..1 (derrapagem, freada, patinada); speed 0..1 (para o chiado da pista molhada)
export function setTires(screech: number, rumble: number, surface: Surface = 'dry', speed = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = Math.min(1, screech);
  // o guincho começa num limiar (pneu no limite) e cresce rápido
  const lvl = s < 0.08 ? 0 : Math.pow((s - 0.08) / 0.92, 0.8);
  dryGain.gain.setTargetAtTime(surface === 'dry' ? lvl * 0.3 : 0, t, 0.04);
  wetGain.gain.setTargetAtTime(surface === 'wet' ? lvl * 0.2 : 0, t, 0.06);
  snowGain.gain.setTargetAtTime(surface === 'snow' ? lvl * 0.28 : 0, t, 0.06);
  // quanto mais escorrega, mais agudo e mais trêmulo o guincho
  const f0 = 980 + 380 * s + Math.sin(t * 7.3) * 35;
  dryBands.forEach((b, i) => b.frequency.setTargetAtTime(f0 * [1, 2.02, 3.1][i], t, 0.05));
  dryLfo.frequency.setTargetAtTime(17 + 10 * s, t, 0.1);
  sprayGain.gain.setTargetAtTime(surface !== 'dry' ? Math.min(1, speed) * (surface === 'wet' ? 0.05 : 0.025) : 0, t, 0.2);
  rumbleGain.gain.setTargetAtTime(Math.min(1, rumble) * 0.25, t, 0.06);
}

export function beep(freq: number, dur = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + dur);
}

// relé do pisca: um clique seco
export function tickSound() {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.012);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  src.connect(f).connect(g).connect(master);
  src.start();
}

// rajada de ruído filtrado (lata amassando, arrasto)
function burst(at: number, dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master);
  src.start(at);
}

// batida leve: pancada seca e um amassadinho
export function bumpSound(power = 0.5) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  g.gain.setValueAtTime(0.35 * power, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g).connect(master);
  o.start();
  o.stop(t + 0.25);
  burst(t, 0.12, 700, 2.5, 0.25 * power);
  burst(t + 0.03, 0.09, 1300, 3, 0.15 * power);
}

// vapor/fumaça do motor batido: chiado contínuo
let steamGain: GainNode | null = null;
export function setSteam(level: number) {
  if (!ctx) return;
  if (!steamGain) {
    steamGain = ctx.createGain();
    steamGain.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2800;
    loopNoise().connect(f).connect(steamGain).connect(master);
  }
  steamGain.gain.setTargetAtTime(Math.min(1, level) * 0.045, ctx.currentTime, 0.2);
}

// batida: estrondo grave, lata amassando, cacos de vidro e o carro arrastando até parar
export function crashSound(power = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  // lata amassando: várias pancadas metálicas em sequência
  for (let k = 0; k < 7; k++) burst(t + k * 0.035 + Math.random() * 0.02, 0.1 + Math.random() * 0.08, 380 + Math.random() * 900, 2 + Math.random() * 3, 0.32 * power);
  // arrasto de lata no asfalto enquanto desliza
  burst(t + 0.18, 1.3 * power + 0.3, 1800, 1.4, 0.12 * power, 'bandpass', 700);
  const thump = ctx.createOscillator();
  const tg = ctx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(140, t);
  thump.frequency.exponentialRampToValueAtTime(35, t + 0.4);
  tg.gain.setValueAtTime(0.5, t);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  thump.connect(tg).connect(master);
  thump.start();
  thump.stop(t + 0.5);
  const len = Math.floor(ctx.sampleRate * 0.7);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = 0.35;
  src.buffer = buf;
  src.connect(g).connect(master);
  src.start();
  for (let k = 0; k < 6; k++) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    const at = t + 0.08 + k * 0.05 + Math.random() * 0.04;
    o.type = 'triangle';
    o.frequency.value = 2500 + Math.random() * 3000;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.setValueAtTime(0.05, at);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(at + 0.1);
  }
}

// raspão: batida leve de lataria
export function scrapeSound() {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.25);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  src.connect(f).connect(g).connect(master);
  src.start();
}

// ---------- sirene da polícia ----------
let siren: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
export function setSiren(on: boolean) {
  if (!ctx) return;
  if (!siren) {
    siren = ctx.createOscillator();
    siren.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 1.6;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(siren.frequency);
    siren.frequency.value = 720;
    siren.connect(sirenGain).connect(master);
    siren.start();
    lfo.start();
  }
  sirenGain!.gain.setTargetAtTime(on ? 0.04 : 0, ctx.currentTime, 0.1);
}

// ---------- trilha (sequenciador simples, 4 vozes de chip) ----------
// Cada música: andamento, tom, progressão de acordes (graus) e um padrão de melodia
// que se repete sobre os acordes, com baixo e bateria. Tudo gerado aqui, sem arquivos.
interface Song { bpm: number; root: number; minor: boolean; chords: number[]; lead: number[]; bassStyle: 0 | 1 }
const SONGS: Record<string, Song> = {
  menu: { bpm: 112, root: 57, minor: false, chords: [0, 5, 3, 4], lead: [0, 2, 4, 2, 7, 4, 2, -1], bassStyle: 0 },
  r0: { bpm: 148, root: 52, minor: true, chords: [0, 5, 3, 4], lead: [7, -1, 7, 9, 10, 9, 7, 4, 7, -1, 4, 5, 7, -1, 2, -1], bassStyle: 1 },
  r1: { bpm: 156, root: 55, minor: false, chords: [0, 3, 4, 0], lead: [4, 4, 7, 4, 9, -1, 7, -1, 4, 2, 0, 2, 4, -1, -1, -1], bassStyle: 1 },
  r2: { bpm: 140, root: 50, minor: true, chords: [0, 6, 5, 4], lead: [0, 3, 7, 10, 12, 10, 7, 3, 5, -1, 7, -1, 3, 2, 0, -1], bassStyle: 0 },
  r3: { bpm: 164, root: 53, minor: true, chords: [0, 3, 6, 4], lead: [12, -1, 10, 12, 15, -1, 12, 10, 7, -1, 8, 7, 5, -1, 3, -1], bassStyle: 1 },
};
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

let musicGain: GainNode | null = null;
let timer: number | undefined;
let song: Song | null = null;
let step = 0, nextT = 0;
let pendingMusic: string | null = null;
let current: string | null = null;

function note(type: OscillatorType, freq: number, t: number, dur: number, vol: number) {
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicGain!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(kind: 'kick' | 'snare' | 'hat', t: number) {
  if (kind === 'kick') {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(musicGain!);
    o.start(t);
    o.stop(t + 0.15);
    return;
  }
  const src = ctx!.createBufferSource();
  src.buffer = noiseBuffer(kind === 'hat' ? 0.04 : 0.12);
  const f = ctx!.createBiquadFilter();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const g = ctx!.createGain();
  g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'hat' ? 0.04 : 0.12));
  src.connect(f).connect(g).connect(musicGain!);
  src.start(t);
}

function schedule() {
  if (!ctx || !song) return;
  const s = song;
  const six = 60 / s.bpm / 4; // semicolcheia
  const scale = s.minor ? MINOR : MAJOR;
  const deg = (d: number) => {
    const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
    return scale[i] + 12 * o;
  };
  while (nextT < ctx.currentTime + 0.12) {
    const bar = Math.floor(step / 16) % s.chords.length;
    const pos = step % 16;
    const chord = s.chords[bar];
    const root = s.root + deg(chord);
    // baixo
    if (s.bassStyle === 1 ? pos % 2 === 0 : pos % 4 === 0) {
      const oct = s.bassStyle === 1 && pos % 4 === 2 ? 12 : 0;
      note('triangle', hz(root - 12 + oct), nextT, six * 1.8, 0.22);
    }
    // arpejo do acorde (onda quadrada baixinha)
    if (pos % 2 === 1) {
      const arp = [0, 2, 4, 7][(pos >> 1) % 4];
      note('square', hz(s.root + 12 + deg(chord + arp)), nextT, six * 0.9, 0.025);
    }
    // melodia
    const ln = s.lead[(step % (s.lead.length * 2)) >> 1];
    if (pos % 2 === 0 && ln >= 0) note('square', hz(s.root + 12 + deg(chord + ln) + (bar === 3 ? 0 : 0)), nextT, six * 1.7, 0.045);
    // bateria
    if (pos % 8 === 0) drum('kick', nextT);
    if (pos % 8 === 4) drum('snare', nextT);
    if (pos % 2 === 0) drum('hat', nextT);
    step++;
    nextT += six;
  }
}

function startMusic(id: string) {
  if (!ctx) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.connect(master);
  }
  musicGain.gain.setTargetAtTime(musicOn ? 0.5 : 0, ctx.currentTime, 0.05);
  if (current === id) return;
  current = id;
  song = SONGS[id] ?? SONGS.menu;
  step = 0;
  nextT = ctx.currentTime + 0.05;
  if (timer === undefined) timer = window.setInterval(schedule, 25);
}

// toca a música indicada ('menu' ou 'r0'..'r3'); começa assim que o áudio for liberado
export function playMusic(id: string) {
  pendingMusic = id;
  startMusic(id);
}

export function stopMusic() {
  pendingMusic = null;
  current = null;
  song = null;
}

export function setMusicOn(on: boolean) {
  musicOn = on;
  if (ctx && musicGain) musicGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
}
