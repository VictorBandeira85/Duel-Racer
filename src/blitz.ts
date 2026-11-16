import { LANE_W, SEG_LEN } from './config';
import { audioCtx, audioOut, noiseBuffer } from './audio';
import type { Track } from './track';
import { lerp, rng } from './util';

// Blitz da polícia: num dos pontos de polícia do trecho (no máximo um, escolhido pela seed) a viatura
// fica encostada na faixa da direita, com o giroflex aceso, um policial em pé ao lado anotando no bloco
// e uma fileira de cones fechando a faixa aos poucos (afunila, segue reta ao lado da viatura e abre de
// novo). Placas BLITZ / REDUZA avisam antes. Passou devagar: nada acontece; rápido: a viatura sai atrás.

export const BLITZ_KMH = 60; // limite na blitz (acima disso a viatura sai atrás)
// tamanho do cone no mundo (na escala da largura dos carros: CAR_W = 1,8 m -> cone de ~70 cm)
export const CONE_W = 250, CONE_H = 420;
const SEG_M = (SEG_LEN * 0.025) / 3.6; // metros por segmento (KMH = 0,025)
export const BLITZ_SIGNS_M = [350, 150]; // placas BLITZ / REDUZA antes da viatura

export interface Cone {
  cone: true;
  z: number;
  x: number;
  y: number; // altura do chão (voando)
  vx: number;
  vy: number;
  vz: number;
  rot: number; // giro (0 = em pé; ±π/2 = deitado)
  vr: number;
  hit: boolean; // derrubado
  kind?: 'horse' | 'barrel'; // cavalete ou barril da obra (src/obra.ts); sem nada: cone
}

// largura no mundo de cada peça que fecha a faixa (cone, cavalete listrado, barril)
export const HORSE_W = 760, HORSE_H = 620, BARREL_W = 400, BARREL_H = 560;
export const coneW = (c: Cone) => (c.kind === 'horse' ? HORSE_W : c.kind === 'barrel' ? BARREL_W : CONE_W);

// faixa fechada por uma fileira de cones (blitz e obra): afunila de outer até inner entre z0 e z1,
// segue fechada até z2 e abre de novo até z3. pad: meia largura da peça mais larga da fileira
export interface Closure {
  inner: number;
  outer: number;
  z0: number; z1: number; z2: number; z3: number;
  cones: Cone[];
  pad?: number;
}

// policial da blitz: em pé ao lado da viatura, anotando no bloco
export interface BlitzCop { blitzCop: true; z: number; x: number }

export interface Blitz extends Closure {
  z: number; // onde fica a viatura
  copX: number;
  officer: BlitzCop;
  max: number; // maior velocidade do jogador chegando na viatura (vale para a perseguição e a multa)
}

// qual ponto de polícia vira blitz (índice em policeSpots) ou -1: ~60% dos trechos têm uma, nunca no
// começo do trecho nem perto de túnel (os cones e a viatura precisam de pista aberta)
export function pickBlitz(track: Pick<Track, 'segments' | 'startZ' | 'finishZ'>, spots: number[], seed: number) {
  const r = rng(seed * 13 + 29);
  if (!spots.length || r() > 0.6) return -1;
  const first = Math.floor(r() * spots.length);
  for (let k = 0; k < spots.length; k++) {
    const i = (first + k) % spots.length, z = spots[i];
    if (z - track.startZ < 400 * SEG_LEN || track.finishZ - z < 200 * SEG_LEN) continue;
    const si = Math.floor(z / SEG_LEN);
    const back = Math.round(BLITZ_SIGNS_M[0] / SEG_M) + 20;
    if (track.segments.slice(si - back, si + 40).some((sg) => sg.tunnel)) continue;
    return i;
  }
  return -1;
}

// linha dos cones num z (fora da blitz: no acostamento)
export function coneLine(b: Closure, z: number) {
  if (z <= b.z0 || z >= b.z3) return b.outer;
  if (z < b.z1) return lerp(b.outer, b.inner, (z - b.z0) / (b.z1 - b.z0));
  if (z <= b.z2) return b.inner;
  return lerp(b.inner, b.outer, (z - b.z2) / (b.z3 - b.z2));
}

// até onde (x) um carro na nossa mão pode ir nesse z sem pegar os cones (Infinity: fora da blitz)
export function blitzEdge(b: Closure | null, z: number) {
  if (!b || z < b.z0 - SEG_LEN * 2 || z > b.z3) return Infinity;
  return coneLine(b, z) - (b.pad ?? CONE_W / 2) - 90;
}

export function makeBlitz(track: Track, z: number): Blitz {
  const R = track.roadW;
  // quatro faixas: fecha a da direita inteira; mão dupla: fecha meia faixa (o carro passa espremido)
  const inner = track.lanes === 4 ? R - LANE_W + 180 : R - 760;
  const outer = R + 450;
  const copX = track.lanes === 4 ? R - LANE_W / 2 + 120 : R + 300;
  const b: Blitz = {
    z, copX, inner, outer, cones: [], max: 0,
    z0: z - 46 * SEG_LEN, z1: z - 10 * SEG_LEN, z2: z + 14 * SEG_LEN, z3: z + 26 * SEG_LEN,
    // ao lado da viatura, do lado da pista (entre os cones e ela), um pouco à frente da traseira
    officer: { blitzCop: true, z: z - 3 * SEG_LEN, x: inner + 430 },
  };
  for (let cz = b.z0; cz <= b.z3 + 1; cz += 3 * SEG_LEN) {
    b.cones.push({ cone: true, z: cz, x: coneLine(b, cz), y: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, hit: false });
  }
  return b;
}

// derruba o cone: voa um pouco para a frente e para o lado, girando, e cai rolando
export function knockCone(c: Cone, speed: number, side: number, rand: () => number) {
  if (c.hit) return;
  c.hit = true;
  const v = Math.max(1500, speed);
  const m = c.kind ? 0.6 : 1; // cavalete e barril: mais pesados, voam menos e giram mais devagar
  c.vz = v * (0.55 + rand() * 0.25) * m;
  c.vx = side * (900 + rand() * 1400 + v * 0.08) * m;
  c.vy = (900 + Math.min(1800, v * 0.12) + rand() * 400) * m;
  c.vr = side * (7 + rand() * 6) * m;
}

const CONE_G = 7000; // gravidade do cone (na escala vertical do desenho)
export function updateCones(b: Closure, dt: number) {
  for (const c of b.cones) {
    if (!c.hit) continue;
    if (c.y > 0 || c.vy > 0) {
      c.vy -= CONE_G * dt;
      c.y = Math.max(0, c.y + c.vy * dt);
      c.rot += c.vr * dt;
      if (c.y === 0 && c.vy < 0) {
        // bateu no chão: quica baixo e perde giro
        c.vy = Math.abs(c.vy) > 900 ? -c.vy * 0.3 : 0;
        c.vr *= 0.5;
      }
    } else {
      // no chão: rola e escorrega até parar, deitado
      const n = Math.atan2(Math.sin(c.rot), Math.cos(c.rot));
      const lie = (Math.sign(Math.sin(n)) || 1) * (Math.PI / 2);
      c.rot = n + (lie - n) * Math.min(1, dt * 8);
      c.vr = 0;
    }
    const fr = c.y > 0 ? 0.4 : 3.5; // atrito no asfalto
    c.vz *= Math.exp(-fr * dt);
    c.vx *= Math.exp(-fr * dt);
    c.z += c.vz * dt;
    c.x += c.vx * dt;
  }
}

// cone de trânsito em pixel art: base quadrada preta, corpo laranja afunilado com luz à esquerda e
// sombra à direita, duas faixas brancas refletivas (a de cima mais larga). x = centro, y = base
export function drawCone(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bh = Math.max(1, h * 0.1);
  c.fillStyle = '#16161a';
  c.fillRect(x - w / 2, y - bh, w, bh);
  c.fillStyle = '#2c2c32';
  c.fillRect(x - w / 2, y - bh, w, Math.max(0.5, bh * 0.35));
  const yb = y - bh, yt = y - h, wb = w * 0.36, wt = w * 0.09;
  const at = (t: number) => [yb + (yt - yb) * t, wb + (wt - wb) * t] as const; // altura e meia largura
  const band = (t0: number, t1: number, col: string) => {
    const [y0, w0] = at(t0), [y1, w1] = at(t1);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - w0, y0);
    c.lineTo(x + w0, y0);
    c.lineTo(x + w1, y1);
    c.lineTo(x - w1, y1);
    c.closePath();
    c.fill();
  };
  band(0, 1, '#f26a12');
  // sombra à direita e luz à esquerda (faixas verticais acompanhando o afunilado)
  c.save();
  c.beginPath();
  c.moveTo(x - wb, yb); c.lineTo(x + wb, yb); c.lineTo(x + wt, yt); c.lineTo(x - wt, yt);
  c.closePath();
  c.clip();
  c.fillStyle = '#b8440a';
  c.beginPath();
  c.moveTo(x + wb * 0.35, yb); c.lineTo(x + wb, yb); c.lineTo(x + wt, yt); c.lineTo(x + wt * 0.35, yt);
  c.closePath();
  c.fill();
  c.fillStyle = '#ff9a40';
  c.beginPath();
  c.moveTo(x - wb * 0.75, yb); c.lineTo(x - wb * 0.4, yb); c.lineTo(x - wt * 0.4, yt); c.lineTo(x - wt * 0.75, yt);
  c.closePath();
  c.fill();
  c.restore();
  band(0.5, 0.68, '#f4f4f0');
  band(0.24, 0.34, '#f4f4f0');
  // sombra das faixas brancas (lado direito)
  c.fillStyle = '#b4b4b8';
  for (const [t0, t1] of [[0.5, 0.68], [0.24, 0.34]]) {
    const [y0, w0] = at(t0), [y1] = at(t1);
    c.fillRect(x + w0 * 0.4, y1, w0 * 0.6, y0 - y1);
  }
  c.fillStyle = '#c85010';
  c.fillRect(x - wt, yt, wt * 2, Math.max(0.5, h * 0.03)); // boca do cone
}

// placa de blitz (temporária, de obra: laranja com borda e letras pretas) em dois postes
export function drawBlitzSign(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  drawWorkSign(c, x, y, w, h, 'BLITZ', 'REDUZA');
}
// placa temporária laranja (blitz e obra): duas linhas de letra, ou a de baixo trocada por uma seta
// (arrow: -1 para a esquerda, 1 para a direita)
export function drawWorkSign(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, l1: string, l2: string, arrow = 0) {
  for (const px of [-0.32, 0.32]) {
    c.fillStyle = '#6a6a72';
    c.fillRect(x + w * px - w * 0.035, y - h * 0.45, w * 0.07, h * 0.45);
    c.fillStyle = '#a4a4ac';
    c.fillRect(x + w * px - w * 0.035, y - h * 0.45, w * 0.025, h * 0.45);
  }
  const top = y - h, ph = h * 0.6;
  c.fillStyle = '#111';
  c.fillRect(x - w / 2, top, w, ph);
  const m = w * 0.05;
  c.fillStyle = '#ff8418';
  c.fillRect(x - w / 2 + m, top + m, w - m * 2, ph - m * 2);
  c.fillStyle = '#ffb060'; // filete de luz em cima e à esquerda
  c.fillRect(x - w / 2 + m, top + m, w - m * 2, Math.max(0.5, m * 0.5));
  c.fillRect(x - w / 2 + m, top + m, Math.max(0.5, m * 0.5), ph - m * 2);
  c.fillStyle = '#c85a08'; // sombra embaixo e à direita
  c.fillRect(x - w / 2 + m, top + ph - m * 1.5, w - m * 2, Math.max(0.5, m * 0.5));
  c.fillRect(x + w / 2 - m * 1.5, top + m, Math.max(0.5, m * 0.5), ph - m * 2);
  if (w > 12) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#111';
    c.font = `bold ${Math.max(4, Math.floor(Math.min(ph * 0.34, (w * 0.86) / (l1.length * 0.6))))}px monospace`; // (palavra comprida: letra menor)
    c.fillText(l1, x, top + ph * 0.33);
    c.fillRect(x - w * 0.36, top + ph * 0.54, w * 0.72, Math.max(0.5, ph * 0.03));
    if (arrow) {
      // seta grossa: haste e ponta em degraus
      const ay = top + ph * 0.75, aw = w * 0.26, ah = ph * 0.09;
      c.fillRect(x - aw * 0.8, ay - ah / 2, aw * 1.4, ah);
      c.beginPath();
      c.moveTo(x + arrow * aw * 1.1, ay);
      c.lineTo(x + arrow * aw * 0.45, ay - ah * 1.9);
      c.lineTo(x + arrow * aw * 0.45, ay + ah * 1.9);
      c.closePath();
      c.fill();
    } else {
      c.font = `bold ${Math.max(3, Math.floor(ph * 0.22))}px monospace`;
      c.fillText(l2, x, top + ph * 0.73);
    }
  } else {
    // longe: só as duas linhas de letra
    c.fillStyle = '#111';
    c.fillRect(x - w * 0.3, top + ph * 0.28, w * 0.6, ph * 0.12);
    c.fillRect(x - w * 0.25, top + ph * 0.66, w * 0.5, ph * 0.08);
  }
}

// cone derrubado: "toc" oco de plástico (grave, sem agudo) e o quique arrastando no asfalto
export function coneSound(power = 0.6) {
  const ctx = audioCtx(), out = audioOut();
  if (!ctx || !out) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(330, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32 * power, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.14);
  // batidinhas do cone quicando e rolando (ruído filtrado, cada vez mais fraco)
  for (let k = 0; k < 3; k++) {
    const at = t + 0.16 + k * 0.11 + Math.random() * 0.03;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gg = ctx.createGain();
    src.buffer = noiseBuffer(0.08);
    f.type = 'bandpass';
    f.frequency.value = 650 + Math.random() * 200;
    f.Q.value = 2.5;
    gg.gain.setValueAtTime(0.18 * power * 0.55 ** k, at);
    gg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    src.connect(f).connect(gg).connect(out);
    src.start(at);
    src.stop(at + 0.08);
  }
}
