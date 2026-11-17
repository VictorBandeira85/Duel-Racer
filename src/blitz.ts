import { LANE_W, SEG_LEN } from './config';
import { audioCtx, audioOut, noiseBuffer } from './audio';
import type { Track } from './track';
import { lerp, rng } from './util';

// Blitz da polícia: num dos pontos de polícia do trecho (no máximo um, escolhido pela seed) a viatura
// fica encostada na faixa da direita, com o giroflex aceso, um policial em pé ao lado anotando no bloco
// e uma fileira de cones fechando a faixa aos poucos (afunila, segue reta ao lado da viatura e abre de
// novo). Placas BLITZ / REDUZA avisam antes. Passou devagar: nada acontece; rápido: a viatura sai atrás.

export const BLITZ_KMH = 60; // limite na blitz (acima disso a viatura sai atrás)
// tamanho do cone no mundo (na escala da largura dos carros: CAR_W = 1,8 m -> ~600 por metro): 70 cm de
// altura; CONE_W é a base (batida), a arte (src/assets/obra/cone.png) sai na própria proporção
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

// largura e altura no mundo de cada peça que fecha a faixa (cone, cavalete listrado, barril), na proporção
// da arte: cavalete 1,2 m (com o pisca no alto) x 1,25 m de largura, tambor de 1 m
export const HORSE_W = 740, HORSE_H = 720, BARREL_W = 403, BARREL_H = 600;
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
