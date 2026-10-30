// Trilha synthwave retrô, sintetizada aqui mesmo (sem arquivos): baixo de serra pulsando em
// colcheias pelo filtro, pad de serras desafinadas, arpejo com eco, melodia com vibrato e bateria
// eletrônica com a caixa "gated" dos anos 80. Cada música tem partes (intro, verso, refrão, ponte)
// que se alternam, para não cansar numa corrida longa. Registro médio: nada agudo demais.

export interface Track {
  title: string;
  bpm: number;
  root: number; // nota MIDI da tônica (baixo uma oitava abaixo)
  mode: 'minor' | 'dorian' | 'major' | 'phrygian';
  verse: number[]; // graus dos acordes, um por compasso
  chorus: number[];
  arp: number[]; // padrão do arpejo (graus somados ao acorde), 16 semicolcheias, -1 pausa
  lead: number[]; // melodia do refrão, 32 semicolcheias (graus sobre a tônica), -1 pausa
  bass: 'eighths' | 'octaves' | 'gallop' | 'half';
  drums: 'four' | 'back' | 'half' | 'drive';
  bright: number; // abertura do filtro (0..1)
}

const T = (title: string, bpm: number, root: number, mode: Track['mode'], verse: number[], chorus: number[], arp: number[], lead: number[], bass: Track['bass'], drums: Track['drums'], bright: number): Track =>
  ({ title, bpm, root, mode, verse, chorus, arp, lead, bass, drums, bright });
const _ = -1;
const ARP_UP = [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 7];
const ARP_ROLL = [0, 4, 7, 4, 0, 4, 7, 9, 0, 4, 7, 4, 0, 4, 9, 7];
const ARP_GATE = [0, _, 7, _, 4, _, 7, 0, _, 7, 4, _, 9, _, 7, _];
const ARP_OCT = [0, 7, 0, 7, 2, 7, 2, 7, 4, 7, 4, 7, 2, 7, 2, 7];
const ARP_SPARSE = [0, _, _, 4, _, _, 7, _, _, 4, _, _, 2, _, _, _];

// 4 do menu e 16 de corrida
export const TRACKS: Track[] = [
  T('Neon Garagem', 96, 45, 'minor', [0, 5, 3, 6], [0, 5, 3, 4], ARP_SPARSE, [7, _, _, 6, 4, _, 2, _, 4, _, _, _, _, _, _, _, 7, _, 9, _, 7, _, 4, _, 2, _, _, _, 0, _, _, _], 'half', 'half', 0.45),
  T('Pôr do Sol na Revista', 100, 48, 'major', [0, 4, 5, 3], [0, 4, 5, 4], ARP_ROLL, [4, _, 5, _, 4, _, 2, _, 0, _, _, _, 2, _, _, _, 4, _, 7, _, 9, _, 7, _, 4, _, 5, _, 4, _, _, _], 'eighths', 'back', 0.5),
  T('Fita no Toca-Fitas', 92, 43, 'dorian', [0, 3, 0, 4], [5, 3, 0, 4], ARP_GATE, [0, _, 2, _, 3, _, _, _, 4, _, 3, _, 2, _, _, _, 7, _, _, 6, 4, _, _, _, 3, _, 2, _, 0, _, _, _], 'half', 'half', 0.4),
  T('Oficina 24 Horas', 104, 47, 'minor', [0, 6, 5, 4], [3, 4, 0, 0], ARP_UP, [_, _, 4, _, 7, _, 6, _, 4, _, _, _, 2, _, 4, _, 7, _, _, _, 9, _, 7, _, 4, _, 2, _, 4, _, _, _], 'eighths', 'back', 0.5),
  T('Estrada de Néon', 118, 45, 'minor', [0, 5, 3, 6], [0, 5, 3, 4], ARP_UP, [7, _, 7, _, 9, _, 7, _, 4, _, _, _, 4, _, 5, _, 7, _, _, _, 4, _, 2, _, 0, _, 2, _, 4, _, _, _], 'eighths', 'four', 0.6),
  T('Vetor no Horizonte', 124, 48, 'minor', [0, 3, 6, 4], [5, 6, 0, 0], ARP_ROLL, [4, _, 4, 5, 7, _, 4, _, 2, _, 0, _, 2, _, _, _, 4, _, 7, _, 9, _, 11, _, 9, _, 7, _, 4, _, _, _], 'octaves', 'four', 0.65),
  T('Noite na Marginal', 116, 43, 'phrygian', [0, 1, 0, 6], [0, 1, 5, 6], ARP_GATE, [0, _, 1, _, 0, _, _, _, 4, _, 3, _, 1, _, _, _, 0, _, 4, _, 7, _, 6, _, 4, _, 3, _, 1, _, 0, _], 'gallop', 'drive', 0.55),
  T('Turbo de Madrugada', 128, 46, 'minor', [0, 5, 6, 4], [0, 5, 6, 4], ARP_OCT, [7, _, _, 9, 7, _, 4, _, 7, _, _, _, 6, _, 4, _, 2, _, _, _, 4, _, 6, _, 7, _, 9, _, 7, _, _, _], 'octaves', 'drive', 0.7),
  T('Linha Amarela', 120, 50, 'dorian', [0, 3, 4, 3], [0, 6, 3, 4], ARP_UP, [2, _, 4, _, 5, _, 4, _, 2, _, 0, _, _, _, _, _, 4, _, 5, _, 7, _, 9, _, 7, _, 5, _, 4, _, 2, _], 'eighths', 'four', 0.6),
  T('Retrovisor', 112, 44, 'minor', [0, 6, 3, 4], [5, 3, 0, 4], ARP_ROLL, [4, _, _, _, 3, _, 2, _, 0, _, _, _, _, _, 2, _, 4, _, 7, _, 6, _, 4, _, 3, _, 2, _, 0, _, _, _], 'half', 'back', 0.5),
  T('Cromado e Cobalto', 126, 47, 'major', [0, 5, 3, 4], [0, 4, 5, 3], ARP_OCT, [4, _, 4, _, 5, _, 7, _, 9, _, 7, _, 5, _, 4, _, 2, _, 4, _, 5, _, 4, _, 2, _, 0, _, _, _, _, _], 'octaves', 'four', 0.7),
  T('Contramão', 132, 45, 'phrygian', [0, 1, 6, 0], [3, 1, 6, 0], ARP_GATE, [7, _, 8, _, 7, _, 5, _, 3, _, 1, _, 0, _, _, _, 7, _, _, _, 10, _, 8, _, 7, _, 5, _, 3, _, 1, _], 'gallop', 'drive', 0.65),
  T('Painel Digital', 122, 49, 'minor', [0, 3, 5, 4], [6, 5, 3, 4], ARP_UP, [0, _, 2, _, 3, _, 5, _, 7, _, _, _, 5, _, 3, _, 2, _, 3, _, 5, _, 7, _, 9, _, 7, _, 5, _, _, _], 'eighths', 'four', 0.6),
  T('Túnel de Luz', 110, 42, 'dorian', [0, 4, 3, 4], [0, 4, 6, 4], ARP_SPARSE, [_, _, 7, _, 9, _, 10, _, 9, _, 7, _, 4, _, _, _, 3, _, 4, _, 7, _, _, _, 4, _, 3, _, 0, _, _, _], 'half', 'half', 0.45),
  T('Faixa Dupla', 134, 48, 'minor', [0, 5, 3, 6], [3, 4, 5, 6], ARP_OCT, [7, _, 7, _, 7, _, 9, _, 10, _, 9, _, 7, _, 4, _, 7, _, _, _, 5, _, 4, _, 2, _, 4, _, 0, _, _, _], 'octaves', 'drive', 0.75),
  T('Radar Ligado', 128, 43, 'minor', [0, 6, 5, 6], [0, 3, 6, 4], ARP_ROLL, [4, _, 2, _, 4, _, 7, _, 6, _, 4, _, 2, _, _, _, 4, _, 6, _, 7, _, 9, _, 11, _, 9, _, 7, _, _, _], 'gallop', 'four', 0.65),
  T('Chuva no Para-Brisa', 106, 46, 'minor', [0, 5, 3, 4], [5, 3, 0, 0], ARP_SPARSE, [9, _, _, _, 7, _, _, _, 4, _, _, _, 2, _, 4, _, 0, _, _, _, 2, _, 4, _, 7, _, _, _, 4, _, _, _], 'half', 'back', 0.4),
  T('Serra de Neon', 138, 45, 'dorian', [0, 3, 4, 6], [0, 6, 3, 4], ARP_UP, [0, _, 3, _, 4, _, 7, _, 9, _, 7, _, 4, _, 3, _, 0, _, _, _, 3, _, 4, _, 6, _, 7, _, 9, _, _, _], 'octaves', 'drive', 0.75),
  T('Último Trecho', 130, 50, 'minor', [5, 6, 0, 0], [3, 4, 0, 6], ARP_ROLL, [7, _, _, 6, 7, _, 9, _, 7, _, 4, _, 2, _, _, _, 4, _, 7, _, 9, _, 11, _, 12, _, 11, _, 9, _, 7, _], 'eighths', 'four', 0.7),
  T('Bandeirada Final', 136, 47, 'major', [0, 4, 5, 3], [0, 3, 4, 4], ARP_OCT, [4, _, 5, _, 7, _, 9, _, 7, _, 5, _, 4, _, 2, _, 4, _, _, _, 7, _, _, _, 9, _, 11, _, 12, _, _, _], 'octaves', 'drive', 0.8),
];
export const MENU_TRACKS = [0, 1, 2, 3];
export const RACE_TRACKS = TRACKS.map((_, i) => i).filter((i) => i >= 4);

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10] };
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Synthwave {
  private out: GainNode;
  private dry: GainNode;
  private delay: DelayNode;
  private verb: ConvolverNode;
  private noise: AudioBuffer;
  private track: Track | null = null;
  private step = 0;
  private nextT = 0;
  private timer: number | undefined;
  constructor(private ctx: AudioContext, dest: AudioNode) {
    // compressor no fim: segura os picos (bateria + pad + eco somados passavam do limite)
    this.out = ctx.createGain();
    this.out.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.out.connect(comp).connect(dest);
    // eco em semínima pontuada (arpejo e melodia) e um reverb curto de sala
    this.dry = ctx.createGain();
    this.dry.connect(this.out);
    this.delay = ctx.createDelay(1.5);
    const fb = ctx.createGain(), dlp = ctx.createBiquadFilter(), dgain = ctx.createGain();
    fb.gain.value = 0.32;
    dlp.type = 'lowpass';
    dlp.frequency.value = 2600;
    dgain.gain.value = 0.35;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(dgain).connect(this.out);
    this.verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    this.verb.buffer = ir;
    const vg = ctx.createGain();
    vg.gain.value = 0.28;
    this.verb.connect(vg).connect(this.out);
    this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  get title() {
    return this.track?.title ?? '';
  }
  play(i: number) {
    const tr = TRACKS[((i % TRACKS.length) + TRACKS.length) % TRACKS.length];
    if (tr === this.track) return;
    this.track = tr;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.08;
    if (this.timer === undefined) this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop() {
    this.track = null;
  }

  // ---- instrumentos ----
  private voice(type: OscillatorType, freq: number, t: number, dur: number, vol: number, cut: number, opts: { detune?: number; vib?: boolean; send?: number; attack?: number } = {}) {
    const c = this.ctx;
    const g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cut * 1.8, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.6), t + dur);
    f.Q.value = 3;
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g);
    g.connect(this.dry);
    if (opts.send) {
      const s = c.createGain();
      s.gain.value = opts.send;
      g.connect(s);
      s.connect(this.delay);
      s.connect(this.verb);
    }
    for (const dt of opts.detune ? [-opts.detune, opts.detune] : [0]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = dt;
      if (opts.vib) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = 5.5;
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(14, t + dur * 0.5);
        l.connect(lg).connect(o.detune);
        l.start(t);
        l.stop(t + dur + 0.05);
      }
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
  private hit(kind: 'kick' | 'snare' | 'hat' | 'open' | 'tom', t: number, vol = 1) {
    const c = this.ctx;
    if (kind === 'kick' || kind === 'tom') {
      const o = c.createOscillator(), g = c.createGain();
      const f0 = kind === 'kick' ? 120 : 160;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 42 : 80, t + 0.16);
      g.gain.setValueAtTime(0.55 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g).connect(this.dry);
      o.start(t);
      o.stop(t + 0.25);
      return;
    }
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter(), g = c.createGain();
    if (kind === 'snare') {
      // caixa "gated": corpo + ruído com reverb cortado de repente
      f.type = 'bandpass';
      f.frequency.value = 1500;
      f.Q.value = 0.8;
      g.gain.setValueAtTime(0.42 * vol, t);
      g.gain.setValueAtTime(0.3 * vol, t + 0.12);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.16);
      const s = c.createGain();
      s.gain.value = 0.9;
      g.connect(s).connect(this.verb);
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      og.gain.setValueAtTime(0.25 * vol, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(og).connect(this.dry);
      o.start(t);
      o.stop(t + 0.12);
    } else {
      f.type = 'highpass';
      f.frequency.value = 6500;
      const d = kind === 'open' ? 0.18 : 0.035;
      g.gain.setValueAtTime(0.09 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
    }
    src.connect(f).connect(g).connect(this.dry);
    src.start(t, Math.random() * 0.3);
    src.stop(t + 0.3);
  }

  private schedule() {
    const tr = this.track;
    if (!tr) return;
    const c = this.ctx;
    const six = 60 / tr.bpm / 4;
    const sc = SCALES[tr.mode];
    const deg = (d: number) => sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    while (this.nextT < c.currentTime + 0.15) {
      const t = this.nextT, st = this.step;
      // forma: intro (4 compassos) | verso (8) | refrão (8) | verso (8) | refrão (8) | ponte (4), em loop
      const barAll = Math.floor(st / 16);
      const pos = st % 16;
      const loopBar = barAll < 4 ? barAll : 4 + ((barAll - 4) % 36);
      const part = loopBar < 4 ? 'intro' : loopBar < 12 ? 'verse' : loopBar < 20 ? 'chorus' : loopBar < 28 ? 'verse' : loopBar < 36 ? 'chorus' : 'bridge';
      const prog = part === 'chorus' ? tr.chorus : tr.verse;
      const chord = part === 'bridge' ? tr.chorus[(loopBar % 2) + 2] : prog[loopBar % prog.length];
      const root = tr.root + deg(chord);
      const cut = 500 + tr.bright * 2200;
      const full = part === 'chorus' || part === 'verse';
      // pad: acorde de serras desafinadas, uma vez por compasso
      if (pos === 0) {
        for (const iv of [0, 2, 4]) this.voice('sawtooth', hz(tr.root + 12 + deg(chord + iv)), t, six * 16, part === 'intro' ? 0.018 : 0.024, cut * 0.7, { detune: 9, send: 0.4, attack: six * 3 });
      }
      // baixo
      if (part !== 'intro' || barAll >= 2) {
        const b = tr.bass;
        const on = b === 'eighths' ? pos % 2 === 0 : b === 'octaves' ? pos % 2 === 0 : b === 'gallop' ? pos % 4 !== 1 : pos % 8 === 0;
        if (on) {
          const oct = b === 'octaves' && pos % 4 === 2 ? 12 : 0;
          this.voice('sawtooth', hz(root - 12 + oct), t, six * (b === 'half' ? 7 : 1.7), 0.11, 380 + tr.bright * 600);
        }
      }
      // arpejo
      const a = tr.arp[pos];
      if (a >= 0 && part !== 'bridge') this.voice('square', hz(tr.root + 12 + deg(chord + a)), t, six * 0.9, 0.022, cut, { send: 0.55 });
      // melodia (refrão; no segundo verso só as notas longas)
      const ln = tr.lead[st % 32];
      if (ln >= 0 && (part === 'chorus' || (part === 'verse' && loopBar >= 20 && st % 4 === 0))) {
        let dur = 1;
        while (dur < 6 && tr.lead[(st + dur) % 32] === -1) dur++;
        this.voice('sawtooth', hz(tr.root + 12 + deg(ln)), t, six * dur * 0.95, 0.04, cut * 1.1, { detune: 6, vib: dur >= 3, send: 0.5, attack: 0.012 });
      }
      // bateria
      const d = tr.drums;
      if (part !== 'intro' || barAll >= 2) {
        if (d === 'half' ? pos === 0 : d === 'back' ? pos === 0 || pos === 10 : pos % 4 === 0) this.hit('kick', t);
        if (d === 'half' ? pos === 8 : pos === 4 || pos === 12) this.hit('snare', t, part === 'intro' ? 0.6 : 1);
        if (full && (d === 'drive' ? true : pos % 2 === 0)) this.hit(pos % 4 === 2 && d !== 'half' ? 'open' : 'hat', t, d === 'drive' && pos % 2 ? 0.6 : 1);
        // virada no último compasso de cada parte
        if ((loopBar === 11 || loopBar === 19 || loopBar === 27 || loopBar === 35) && pos >= 12) this.hit('tom', t, 0.6 + (pos - 12) * 0.1);
      }
      this.step++;
      this.nextT += six;
    }
  }
}
