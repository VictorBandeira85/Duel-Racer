// Ronco sintetizado por cilindro (AudioWorklet): cada explosão é um pulso de pressão disparado
// no ângulo certo do virabrequim (ordem de ignição real, bancadas de cada lado), que passa por
// um tubo de escapamento (eco curto com realimentação) e pelas ressonâncias da carroceria e do
// silencioso. Sob carga o som satura e fica áspero; aliviando, abafa e solta estalos; no corte de
// giro as explosões falham. O turbo assobia com a pressão e a válvula de alívio chia ao soltar.

export interface EngineSpec {
  name: string;
  cyl: number;
  events: number[]; // ângulo do virabrequim (graus, 0..720) de cada explosão
  banks: number[]; // bancada de cada explosão (0 esquerda, 1 direita): cada uma tem seu tubo
  pipeMs: [number, number]; // comprimento do tubo de cada bancada (eco)
  fb: number; // realimentação do tubo (ressonância de tubo)
  res: [number, number, number][]; // ressonâncias do escapamento: frequência, Q, ganho
  pulse: number; // duração do pulso (ms) em giro baixo
  drive: number; // saturação sob carga (aspereza)
  rasp: number; // ruído de combustão (chiado metálico)
  low: number; // corte de agudos sem carga (Hz) — sob carga abre até low * 4
  jitter: number; // irregularidade entre cilindros (0..0.3)
  pops: number; // estalos ao aliviar em giro alto
  turbo: boolean;
  vol: number; // nivelamento de volume entre motores
  idle: number; // giro de marcha lenta (rpm)
  redline: number; // giro máximo (rpm)
}

// ângulos igualmente espaçados num ciclo de 720°
const even = (n: number) => Array.from({ length: n }, (_, i) => (720 / n) * i);
const alt = (n: number) => Array.from({ length: n }, (_, i) => i % 2);

const BASE: Record<string, Omit<EngineSpec, 'name' | 'turbo'>> = {
  // 4 em linha: zumbido seco, uma bancada só
  i4: { cyl: 4, events: even(4), banks: [0, 0, 0, 0], pipeMs: [2.6, 2.6], fb: 0.35, res: [[140, 1.2, 1], [620, 2, 0.55], [1900, 3, 0.25]], pulse: 2.2, drive: 1.6, rasp: 0.12, low: 900, jitter: 0.05, pops: 0.25, vol: 1.15, idle: 850, redline: 7000 },
  // 5 em linha: 144° entre explosões, o "gorgolejo" característico
  i5: { cyl: 5, events: even(5), banks: [0, 0, 0, 0, 0], pipeMs: [2.9, 2.9], fb: 0.42, res: [[120, 1.1, 1], [480, 2.2, 0.6], [1500, 3, 0.3]], pulse: 2.4, drive: 1.8, rasp: 0.12, low: 850, jitter: 0.08, pops: 0.4, vol: 1.05, idle: 800, redline: 6800 },
  // 6 em linha: liso e cheio
  i6: { cyl: 6, events: even(6), banks: [0, 0, 0, 1, 1, 1], pipeMs: [3.1, 3.3], fb: 0.4, res: [[110, 1.1, 1], [520, 2.4, 0.6], [1700, 3.5, 0.3]], pulse: 2.4, drive: 1.4, rasp: 0.08, low: 900, jitter: 0.03, pops: 0.25, vol: 1.0, idle: 750, redline: 6800 },
  // V6 a 90°/60°: áspero
  v6: { cyl: 6, events: even(6), banks: alt(6), pipeMs: [2.7, 3.2], fb: 0.38, res: [[130, 1.2, 1], [700, 2.2, 0.65], [2100, 3, 0.35]], pulse: 2.1, drive: 2, rasp: 0.16, low: 1000, jitter: 0.06, pops: 0.35, vol: 1.0, idle: 850, redline: 7600 },
  // V8 virabrequim cruzado: as bancadas disparam em sequência irregular (E D E E D E D D) → batuque
  v8: { cyl: 8, events: even(8), banks: [0, 1, 0, 0, 1, 0, 1, 1], pipeMs: [3.4, 4.6], fb: 0.45, res: [[95, 1, 1.15], [380, 1.8, 0.6], [1300, 3, 0.25]], pulse: 2.8, drive: 2.2, rasp: 0.1, low: 700, jitter: 0.1, pops: 0.6, vol: 0.85, idle: 700, redline: 6600 },
  // V8 virabrequim plano (Ferrari): bancadas alternadas, rosnado rouco que abre em giro alto
  v8flat: { cyl: 8, events: even(8), banks: alt(8), pipeMs: [3.0, 3.4], fb: 0.44, res: [[115, 1.1, 1.15], [460, 1.8, 0.7], [1500, 2.6, 0.28]], pulse: 2.4, drive: 2.0, rasp: 0.1, low: 800, jitter: 0.05, pops: 0.5, vol: 0.85, idle: 900, redline: 7750 },
  // V10: 72°, metálico e rouco
  v10: { cyl: 10, events: even(10), banks: [0, 1, 0, 1, 1, 0, 1, 0, 0, 1], pipeMs: [3.0, 3.6], fb: 0.42, res: [[120, 1.1, 1], [560, 2, 0.7], [1900, 3, 0.4]], pulse: 2.0, drive: 2.3, rasp: 0.18, low: 950, jitter: 0.06, pops: 0.5, vol: 0.8, idle: 800, redline: 6200 },
  // V12: 60°, liso e encorpado, cresce num uivo em giro alto
  v12: { cyl: 12, events: even(12), banks: alt(12), pipeMs: [3.0, 3.5], fb: 0.44, res: [[105, 1.1, 1.15], [420, 1.8, 0.75], [1350, 2.6, 0.3]], pulse: 2.3, drive: 1.8, rasp: 0.07, low: 820, jitter: 0.04, pops: 0.45, vol: 0.8, idle: 850, redline: 7100 },
  // W8: duas bancadas em V estreito, firme e grave
  w8: { cyl: 8, events: even(8), banks: [0, 1, 1, 0, 1, 0, 0, 1], pipeMs: [3.0, 3.4], fb: 0.4, res: [[110, 1.1, 1], [480, 2, 0.6], [1600, 3, 0.3]], pulse: 2.4, drive: 1.9, rasp: 0.12, low: 850, jitter: 0.06, pops: 0.35, vol: 0.85, idle: 750, redline: 6500 },
  // W12: liso como V12, mais encorpado
  w12: { cyl: 12, events: even(12), banks: alt(12), pipeMs: [2.8, 3.0], fb: 0.36, res: [[120, 1.1, 1], [600, 2, 0.65], [2000, 3, 0.35]], pulse: 2.0, drive: 1.6, rasp: 0.08, low: 950, jitter: 0.03, pops: 0.3, vol: 0.8, idle: 700, redline: 6400 },
  // diesel de caminhão: giro baixo, batida pesada e chiado de injeção
  diesel: { cyl: 6, events: even(6), banks: [0, 0, 0, 0, 0, 0], pipeMs: [5.5, 5.5], fb: 0.5, res: [[70, 1, 1.2], [300, 1.6, 0.6], [1100, 2.5, 0.4]], pulse: 4.5, drive: 2.4, rasp: 0.35, low: 600, jitter: 0.12, pops: 0, vol: 1.0, idle: 600, redline: 2600 },
  // boxer 4 a ar (Fusca, Puma): batida irregular e chocalho
  flat4: { cyl: 4, events: even(4), banks: [0, 0, 1, 1], pipeMs: [3.6, 4.4], fb: 0.5, res: [[100, 1, 1], [420, 1.8, 0.6], [1400, 2.5, 0.35]], pulse: 2.8, drive: 1.9, rasp: 0.2, low: 750, jitter: 0.14, pops: 0.2, vol: 1.15, idle: 900, redline: 5600 },
  // boxer 6 (959): rouco e metálico
  flat6: { cyl: 6, events: even(6), banks: [0, 1, 0, 1, 0, 1], pipeMs: [2.8, 3.1], fb: 0.42, res: [[130, 1.2, 1], [650, 2.2, 0.7], [2200, 3, 0.4]], pulse: 2.0, drive: 2, rasp: 0.2, low: 1000, jitter: 0.05, pops: 0.35, vol: 0.95, idle: 900, redline: 7600 },
  // boxer 12 (Testarossa): encorpado com rosnado
  flat12: { cyl: 12, events: even(12), banks: alt(12), pipeMs: [2.9, 3.3], fb: 0.42, res: [[115, 1.1, 1.1], [500, 1.9, 0.7], [1700, 2.8, 0.32]], pulse: 2.1, drive: 1.9, rasp: 0.12, low: 900, jitter: 0.04, pops: 0.45, vol: 0.8, idle: 900, redline: 7000 },
};

// tipo de motor pela ficha ("V8 biturbo", "Boxer 6 biturbo", "12 cil. boxer", "4 cil. turbo"...)
export function engineSpec(desc: string, carId = ''): EngineSpec {
  const d = desc.toLowerCase();
  const turbo = d.includes('turbo');
  const boxer = d.includes('boxer');
  let k = 'v8';
  if (d.includes('diesel')) k = 'diesel';
  else if (d.includes('w12')) k = 'w12';
  else if (d.includes('w8')) k = 'w8';
  else if (d.includes('v12')) k = 'v12';
  else if (d.includes('v10')) k = 'v10';
  else if (d.includes('v6')) k = 'v6';
  else if (boxer) k = d.includes('12') ? 'flat12' : d.includes('6') ? 'flat6' : 'flat4';
  else if (/\b5 cil|i5|5 em linha/.test(d)) k = 'i5';
  else if (/\b6 cil|i6|6 em linha/.test(d)) k = 'i6';
  else if (/\b4 cil|i4|4 em linha/.test(d)) k = 'i4';
  else if (d.includes('v8')) k = carId.startsWith('furia') ? 'v8flat' : 'v8'; // Ferrari: virabrequim plano
  const b = BASE[k];
  // turbo: o rotor abafa o escapamento (menos agudo, menos estalo de tubo)
  return turbo ? { ...b, name: k + 'turbo', turbo: true, low: b.low * 0.8, fb: b.fb * 0.85, pops: b.pops * 1.3 } : { ...b, name: k, turbo: false };
}

// processador (roda na thread de áudio): carregado de um Blob, sem arquivo separado
export const WORKLET = `
class Biquad {
  constructor() { this.b0 = 0; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  band(f, q, sr) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    this.b0 = al / a0; this.b1 = 0; this.b2 = -al / a0; this.a1 = -2 * Math.cos(w) / a0; this.a2 = (1 - al) / a0;
  }
  low(f, q, sr) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al, c = Math.cos(w);
    this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
class Engine extends AudioWorkletProcessor {
  constructor() {
    super();
    this.spec = null; this.rpm = 0; this.load = 0; this.on = 0; this.boost = 0; this.pitch = 1;
    this.rpmS = 0; this.loadS = 0; this.onS = 0; this.theta = 0;
    this.pulses = []; this.seed = 1;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.spec) this.setSpec(m.spec);
      if (m.rpm !== undefined) { this.rpm = m.rpm; this.load = m.load; this.on = m.on; this.boost = m.boost; this.pitch = m.pitch ?? 1; }
    };
  }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  setSpec(s) {
    this.spec = s;
    const N = Math.ceil(sampleRate * 0.02);
    this.pipe = [0, 1].map(() => ({ buf: new Float32Array(N), i: 0 }));
    this.res = [0, 1].map(() => s.res.map(() => new Biquad()));
    this.lp = [new Biquad(), new Biquad()];
    this.cylGain = s.events.map(() => 1 + (this.rand() * 2 - 1) * s.jitter);
    this.next = 0;
    this.retune = 0;
  }
  process(_, outputs) {
    const out = outputs[0][0];
    const s = this.spec;
    if (!s) { out.fill(0); return true; }
    const sr = sampleRate, n = out.length;
    const ev = s.events, E = ev.length;
    // ajustes suaves (sem degraus no som)
    const k = 1 - Math.exp(-n / (sr * 0.03));
    this.rpmS += (this.rpm - this.rpmS) * k;
    this.loadS += (this.load - this.loadS) * (1 - Math.exp(-n / (sr * 0.06)));
    this.onS += (this.on - this.onS) * (1 - Math.exp(-n / (sr * 0.05)));
    const rpm = s.idle + Math.max(0, this.rpmS) * (s.redline - s.idle);
    const limiter = this.rpmS > 1.0;
    const load = this.loadS;
    // filtros conforme carga e giro
    if (--this.retune <= 0) {
      this.retune = 4;
      const lpf = s.low * (1 + load * 3) * (0.8 + this.rpmS * 0.6) * (s.turbo ? 1 - 0.25 * this.boost : 1);
      for (let b = 0; b < 2; b++) {
        s.res.forEach((r, j) => this.res[b][j].band(r[0] * (1 + 0.15 * this.rpmS) * (b ? 1.04 : 1), r[1], sr));
        this.lp[b].low(lpf, 0.8, sr);
      }
    }
    const degPerSample = (rpm / 60) * 360 / sr * this.pitch; // pitch: efeito Doppler (carros passando)
    const interval = 720 / E / degPerSample; // amostras entre explosões
    const pulseLen = Math.max(8, Math.min(s.pulse * sr / 1000, interval * 0.7));
    const amp = (0.5 + 0.5 * load) * this.onS;
    const drive = 1 + s.drive * load;
    const fb = s.fb;
    const pd = [s.pipeMs[0] * sr / 1000, s.pipeMs[1] * sr / 1000];
    const resG = s.res.map((r) => r[2]);
    for (let i = 0; i < n; i++) {
      // explosão quando o virabrequim passa pelo ângulo do próximo cilindro
      const prev = this.theta;
      this.theta += degPerSample;
      if (this.theta >= 720) this.theta -= 720;
      const crossed = (ev[this.next] - prev + 720) % 720 < degPerSample;
      if (crossed && amp > 0.001) {
        let a = amp * this.cylGain[this.next] * (1 + (this.rand() * 2 - 1) * s.jitter * 0.5);
        // corte de giro: falha metade das explosões; aliviando em giro alto, estalos ocasionais
        if (limiter && this.rand() < 0.55) a = 0;
        let pop = 0;
        if (load < 0.15 && this.rpmS > 0.45 && this.rand() < s.pops * 0.05) pop = 2.2 + this.rand() * 1.5;
        if (a > 0 || pop) this.pulses.push({ t: 0, len: pulseLen * (pop ? 1.8 : 1), a: pop ? amp * pop + 0.25 * this.onS : a, b: s.banks[this.next], noise: pop ? 1 : s.rasp * (0.4 + load) });
        this.next = (this.next + 1) % E;
      } else if (crossed) this.next = (this.next + 1) % E;
      // soma dos pulsos ativos, por bancada
      let x0 = 0, x1 = 0;
      for (let p = this.pulses.length - 1; p >= 0; p--) {
        const q = this.pulses[p];
        const u = q.t / q.len;
        // onda de pressão: crista positiva e um vale menor (refluxo)
        let v = u < 0.5 ? Math.sin(u * 2 * Math.PI) : 0.55 * Math.sin(u * 2 * Math.PI);
        v = v * q.a + (this.rand() * 2 - 1) * q.noise * q.a * (1 - u);
        if (q.b) x1 += v; else x0 += v;
        if (++q.t >= q.len) this.pulses.splice(p, 1);
      }
      let y = 0;
      const xs = [x0, x1];
      for (let b = 0; b < 2; b++) {
        // tubo: eco curto realimentado (ressonância do comprimento do escape)
        const P = this.pipe[b], N = P.buf.length;
        const d = pd[b];
        const ri = (P.i - Math.floor(d) + N) % N;
        const echo = P.buf[ri];
        const w = xs[b] + echo * fb;
        P.buf[P.i] = w;
        P.i = (P.i + 1) % N;
        let z = w * 0.5;
        const R = this.res[b];
        for (let j = 0; j < R.length; j++) z += R[j].run(w) * resG[j];
        y += this.lp[b].run(z);
      }
      // saturação (sob carga o som "rasga")
      y = Math.tanh(y * drive * 1.2) / Math.tanh(drive * 1.2);
      out[i] = y * s.vol;
    }
    return true;
  }
}
registerProcessor('engine-synth', Engine);
`;
