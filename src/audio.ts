// Som do motor sintetizado (sem arquivos de áudio)
let ctx: AudioContext | null = null;
let osc1: OscillatorNode, osc2: OscillatorNode, gain: GainNode, filter: BiquadFilterNode;
let muted = false;

export function initAudio() {
  if (ctx) {
    ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  osc1 = ctx.createOscillator();
  osc2 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'square';
  filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  gain = ctx.createGain();
  gain.gain.value = 0;
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  osc1.start();
  osc2.start();
}

export function setEngine(rpm: number, throttle: boolean, on: boolean) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const f = 45 + rpm * 150;
  osc1.frequency.setTargetAtTime(f, t, 0.04);
  osc2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
  filter.frequency.setTargetAtTime(500 + rpm * 1200 + (throttle ? 400 : 0), t, 0.05);
  gain.gain.setTargetAtTime(on && !muted ? (throttle ? 0.09 : 0.05) : 0, t, 0.08);
}

export function beep(freq: number, dur = 0.15) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export function crashSound() {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = 0.35;
  src.buffer = buf;
  src.connect(g).connect(ctx.destination);
  src.start();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

// Sirene da polícia
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
    siren.connect(sirenGain).connect(ctx.destination);
    siren.start();
    lfo.start();
  }
  sirenGain!.gain.setTargetAtTime(on && !muted ? 0.04 : 0, ctx.currentTime, 0.1);
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx && m) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}
