import { engineSpec, WORKLET, type EngineSpec } from './enginesynth';
import { MENU_TRACKS, RACE_TRACKS, Synthwave } from './music';
import { FILE_TRACKS } from './tracks';

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

  // eco de túnel: o ronco e os pneus voltam das paredes (dois atrasos curtos com realimentação,
  // abafados), misturados conforme setTunnel
  echoIn = ctx.createGain();
  echoWet = ctx.createGain();
  echoWet.gain.value = 0;
  for (const [t, fb] of [[0.067, 0.42], [0.113, 0.36]]) {
    const d = ctx.createDelay(0.5), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    d.delayTime.value = t;
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    g.gain.value = fb;
    echoIn.connect(d);
    d.connect(lp).connect(g).connect(d);
    lp.connect(echoWet);
  }
  echoWet.connect(master);
  gain.connect(echoIn);

  // ronco por cilindro (quando o navegador tem AudioWorklet)
  synthGain = ctx.createGain();
  synthGain.gain.value = 0.1;
  synthGain.connect(master);
  synthGain.connect(echoIn);
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
    // assobio mais baixo e discreto (antes chegava a ~5,7 kHz e deixava o som estridente)
    turbo.frequency.setTargetAtTime(1500 + boost * 1700 + r * 600, t, 0.08);
    turboGain.gain.setTargetAtTime(tb * 0.011, t, 0.1);
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

// bip do detector de radar: curto e grave o bastante para não irritar (triangular, baixo volume)
export function radarBeep(freq: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.005);
  g.gain.setValueAtTime(0.09, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.09);
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

// aterrissagem de salto: os pneus batem no asfalto e quicam (2-3 vezes, cada vez mais fracas e
// mais juntas): baque de borracha grave, a suspensão batendo e o "chirp" do pneu ao pegar o
// chão girando (tonal, médio-grave, sem ficar agudo)
export function landSound(power = 0.5) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const bounces = power > 0.55 ? 3 : 2;
  let at = t0, p = Math.min(1, power);
  for (let k = 0; k < bounces; k++) {
    // baque da borracha (o pneu amassando)
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(95 - k * 8, at);
    o.frequency.exponentialRampToValueAtTime(38, at + 0.14);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.42 * p, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + 0.2);
    // suspensão no batente
    burst(at, 0.09, 260, 1.2, 0.2 * p, 'lowpass');
    // chirp: pneu girando que pega o chão (um gemido curto que cai de tom) com chiado
    const sq = ctx.createOscillator(), sf = ctx.createBiquadFilter(), sg = ctx.createGain();
    sq.type = 'sawtooth';
    const f0 = 760 + Math.random() * 90 - k * 60;
    sq.frequency.setValueAtTime(f0, at + 0.005);
    sq.frequency.exponentialRampToValueAtTime(f0 * 0.82, at + 0.12);
    sf.type = 'bandpass';
    sf.frequency.value = 900;
    sf.Q.value = 3;
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(0.11 * p, at + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.07 + 0.08 * p);
    sq.connect(sf).connect(sg).connect(master);
    sq.start(at);
    sq.stop(at + 0.2);
    burst(at + 0.004, 0.06 + 0.06 * p, 1200, 2, 0.12 * p, 'bandpass', 800);
    at += 0.16 - k * 0.05 + 0.08 * p;
    p *= 0.45;
  }
}

// pedra no para-brisa: um "tac" seco de vidro e o estalinho da trinca abrindo
export function stoneSound() {
  if (!ctx) return;
  const t = ctx.currentTime;
  burst(t, 0.03, 3200, 4, 0.3);
  burst(t + 0.002, 0.05, 1700, 6, 0.18);
  for (let k = 0; k < 4; k++) burst(t + 0.05 + k * 0.025 + Math.random() * 0.02, 0.015, 4200 + Math.random() * 1500, 5, 0.06);
}

let echoIn: GainNode | null = null, echoWet: GainNode | null = null;
let lastTunnel = -1;
// dentro do túnel (0..1): o eco das paredes
export function setTunnel(k: number) {
  if (!ctx || !echoWet) return;
  const v = Math.round(k * 20) / 20;
  if (v === lastTunnel) return;
  lastTunnel = v;
  echoWet.gain.setTargetAtTime(v * 0.75, ctx.currentTime, 0.08);
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

// ---------- trilha synthwave (music.ts) ----------
let musicGain: GainNode | null = null;
let music: Synthwave | null = null;
let pendingMusic: string | null = null;
let current: string | null = null;

// id: 'menu' (sorteia uma das do menu), 'race:<n>' (n escolhe uma das de corrida) ou 't:<i>' (faixa i)
function trackFor(id: string) {
  if (id.startsWith('t:')) return Number(id.slice(2));
  if (id.startsWith('race:')) return RACE_TRACKS[Number(id.slice(5)) % RACE_TRACKS.length];
  return MENU_TRACKS[Math.floor(Math.random() * MENU_TRACKS.length)];
}
// as faixas baixadas tocam num elemento <audio> ligado ao mesmo volume da música; se o arquivo
// não carregar (sem internet), toca a versão sintetizada de mesmo número
let fileEl: HTMLAudioElement | null = null;
let fileIdx = -1;
let filesOk = true;
function playFile(i: number) {
  const t = FILE_TRACKS[i];
  // aberto direto do arquivo (file://) o navegador não deixa o Web Audio ler as faixas: usa a sintetizada
  if (!ctx || !musicGain || !t || !filesOk || location.protocol === 'file:') return false;
  if (!fileEl) {
    fileEl = new Audio();
    fileEl.loop = true;
    fileEl.preload = 'auto';
    ctx.createMediaElementSource(fileEl).connect(musicGain);
  }
  const el = fileEl;
  el.onerror = () => {
    if (fileEl !== el || fileIdx !== i) return;
    filesOk = false;
    fileIdx = -1;
    music!.play(i);
  };
  fileIdx = i;
  el.src = `music/${t.file}`;
  el.currentTime = 0;
  el.play().catch(() => {});
  return true;
}
function startMusic(id: string) {
  if (!ctx) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.connect(master);
    music = new Synthwave(ctx, musicGain);
  }
  musicGain.gain.setTargetAtTime(musicOn ? musicVol : 0, ctx.currentTime, 0.05);
  if (current === id) return;
  current = id;
  const i = trackFor(id);
  if (playFile(i)) music!.stop();
  else music!.play(i);
}
export const musicTitle = () => (fileIdx >= 0 ? `${FILE_TRACKS[fileIdx].title} - ${FILE_TRACKS[fileIdx].artist}` : music?.title ?? '');
let musicVol = 0.5;
export function setMusicVolume(v: number) {
  musicVol = 0.5 * v;
  if (ctx && musicGain) musicGain.gain.setTargetAtTime(musicOn ? musicVol : 0, ctx.currentTime, 0.05);
}

// toca a música indicada ('menu', 'race:<n>' ou 't:<faixa>'); começa assim que o áudio for liberado
export function playMusic(id: string) {
  pendingMusic = id;
  startMusic(id);
}

export function stopMusic() {
  pendingMusic = null;
  current = null;
  music?.stop();
  fileEl?.pause();
  fileIdx = -1;
}

export function setMusicOn(on: boolean) {
  musicOn = on;
  if (ctx && musicGain) musicGain.gain.setTargetAtTime(on ? musicVol : 0, ctx.currentTime, 0.05);
}

// segundo plano: suspende tudo (motor, efeitos e a faixa tocando); na volta retoma
export function suspendAudio(hidden: boolean) {
  if (!ctx) return;
  if (hidden) {
    ctx.suspend();
    fileEl?.pause();
  } else {
    ctx.resume();
    if (fileEl && fileIdx >= 0) fileEl.play().catch(() => {});
  }
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
