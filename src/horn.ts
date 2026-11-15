// Buzinas: a do jogador (timbre conforme o carro) e as definições usadas pelo trânsito (trafficaudio.ts).
// Tudo sintetizado: uma ou duas cornetas (osciladores) por um filtro que tira o estridente; a elétrica de
// disco é quadrada e "fanhosa", a de ar (cornetas) é dente de serra com ataque rápido e brilho contido.
import { audioCtx, audioOut } from './audio';

export interface HornDef {
  notes: number[]; // Hz de cada corneta
  wave: OscillatorType;
  filter: BiquadFilterType; fq: number; q: number;
  attack: number; release: number; // s
  vol: number;
  detune?: number; // cents entre as duas vozes de cada nota (batimento da corneta dupla)
}

export const HORNS: Record<string, HornDef> = {
  // europeus e nacionais de porte médio: elétrica bitonal (as duas notas clássicas, terça maior)
  euro: { notes: [405, 510], wave: 'square', filter: 'lowpass', fq: 1900, q: 0.9, attack: 0.008, release: 0.03, vol: 0.085, detune: 6 },
  // japonês: bitonal um pouco mais alta e limpa
  japan: { notes: [420, 525], wave: 'square', filter: 'lowpass', fq: 2100, q: 0.8, attack: 0.006, release: 0.03, vol: 0.08, detune: 4 },
  // italianos (Fúria, Toro): cornetas a ar, duas notas mais agudas em terça, ataque seco
  italian: { notes: [466, 587], wave: 'sawtooth', filter: 'bandpass', fq: 1500, q: 1.1, attack: 0.004, release: 0.05, vol: 0.13, detune: 9 },
  // americanos e os seis/oito cilindros nacionais: bitonal grave e cheia (fá e lá)
  us: { notes: [349, 440], wave: 'square', filter: 'lowpass', fq: 1600, q: 1.0, attack: 0.01, release: 0.04, vol: 0.09, detune: 7 },
  // VW a água (Gol, Voyage, Santana, Passat): bitonal seca
  vw: { notes: [435, 545], wave: 'square', filter: 'lowpass', fq: 1800, q: 1.1, attack: 0.006, release: 0.025, vol: 0.1, detune: 3 },
  // populares (Chevette, 147, Uno, Corsa): uma nota só, fina
  single: { notes: [450], wave: 'square', filter: 'bandpass', fq: 1300, q: 1.4, attack: 0.005, release: 0.02, vol: 0.14, detune: 5 },
  // Fusca e derivados (Onça GTE, Ponto SP2): "fon-fon" de uma nota, nasal
  fusca: { notes: [350], wave: 'square', filter: 'bandpass', fq: 950, q: 1.5, attack: 0.006, release: 0.03, vol: 0.15, detune: 8 },
  // trânsito: picape (grave, a ar) e caminhão (acorde de três cornetas, entra devagar)
  pickup: { notes: [175, 220], wave: 'sawtooth', filter: 'lowpass', fq: 1300, q: 1.2, attack: 0.03, release: 0.06, vol: 0.14, detune: 6 },
  truck: { notes: [147, 185, 220], wave: 'sawtooth', filter: 'lowpass', fq: 1300, q: 0.8, attack: 0.08, release: 0.1, vol: 0.17, detune: 5 },
};

// buzina de cada carro do jogador
const CAR_HORN: Record<string, string> = {
  'furia-f4': 'italian', 'furia-tr': 'italian', 'toro-v12': 'italian', 'toro-lp5': 'italian', 'patrol-sv': 'italian',
  'silber-95': 'euro', 'kaze-nx': 'japan', 'vortex-zr': 'us', 'serpe-v10': 'us', patrol: 'us',
  'br-charger': 'us', 'br-maverick': 'us', 'br-opala': 'us', 'br-pumagtb': 'us', 'br-omega': 'euro',
  'br-vectra': 'euro', 'br-kadett': 'euro', 'br-monza': 'euro', 'br-monzacoupe': 'euro', 'br-tempra': 'euro', 'br-tipo16v': 'euro', 'br-xr3': 'euro',
  'br-golgti': 'vw', 'br-gol16v': 'vw', 'br-voyagesport': 'vw', 'br-santana': 'vw', 'br-passat': 'vw', 'br-voyage': 'single',
  'br-corsa': 'single', 'br-uno': 'single', 'br-147': 'single', 'br-chevette': 'single',
  'br-pumagte': 'fusca', 'br-sp2': 'fusca',
};
export const hornKind = (carId: string) => CAR_HORN[carId] ?? 'euro';

// uma buzina montada num contexto de áudio (o do jogo ou um de medida, fora do tempo real)
export function hornVoice(ctx: BaseAudioContext, def: HornDef, dest: AudioNode) {
  const filter = ctx.createBiquadFilter();
  filter.type = def.filter;
  filter.frequency.value = def.fq;
  filter.Q.value = def.q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const osc: OscillatorNode[] = [];
  for (const n of def.notes) for (const d of [0, def.detune ?? 0]) {
    const o = ctx.createOscillator();
    o.type = def.wave;
    o.frequency.value = n;
    o.detune.value = d;
    o.connect(filter);
    o.start();
    osc.push(o);
  }
  filter.connect(gain).connect(dest);
  // as fanhosas (filtro de banda) perdem volume no filtro; duas vozes por nota somam
  const level = (def.vol * (def.filter === 'bandpass' ? 1.5 : 1)) / Math.sqrt(def.notes.length);
  return {
    on: (t: number, k = 1) => gain.gain.setTargetAtTime(level * k, t, def.attack),
    off: (t: number) => gain.gain.setTargetAtTime(0, t, def.release),
    pitch: (t: number, k: number) => osc.forEach((o, i) => o.frequency.setTargetAtTime(def.notes[i >> 1] * k, t, 0.02)),
    stop: () => osc.forEach((o) => { try { o.stop(); } catch { /* já parado */ } }),
  };
}

// ---------- buzina do jogador ----------
let voice: ReturnType<typeof hornVoice> | null = null;
let voiceKind = '', wantKind = 'euro', sounding = false;
export function setHornCar(carId: string) {
  wantKind = hornKind(carId);
}
export function setHorn(on: boolean) {
  const ctx = audioCtx();
  if (!ctx) return;
  if (on === sounding && (!on || voiceKind === wantKind)) return;
  const t = ctx.currentTime;
  if (voice && voiceKind !== wantKind) {
    const old = voice;
    old.off(t);
    setTimeout(() => old.stop(), 400);
    voice = null;
  }
  if (on && !voice) {
    voice = hornVoice(ctx, HORNS[wantKind], audioOut());
    voiceKind = wantKind;
  }
  if (voice) on ? voice.on(t, 0.65) : voice.off(t); // de dentro do carro: presente, sem cobrir o motor
  sounding = on;
}
