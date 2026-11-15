// Queda das motos do trânsito (arte do Victor, tools/ref/motofall.py): batida por trás com força, a
// moto derrapa inclinada com o piloto (skid), o piloto é jogado para cima e para a frente (fly) enquanto
// a moto deitada escorrega soltando faísca (slide) e depois poeira (dust); o piloto cai, rola (roll) e
// para sentado, tonto com as estrelas (sit), ao lado da moto caída (down). Queda de videogame: sem
// sangue; a moto caída fica como obstáculo e o piloto sentado pula para o lado se alguém vem em cima.
// Moto e piloto andam cada um com a sua velocidade (o piloto vai mais longe). Tudo visto de trás:
// as peças são espelhadas quando a moto cai para a esquerda (o piloto sempre vai para o lado da queda).
import { CAR_W, RES, SEG_LEN } from './config';
import type { CarLook } from './cars';
import { pushCarLights } from './nightlight';
import { svgSprite } from './svgsprites';
import type { TrafficCar } from './race';
import META from './assets/motofall/motofall.json';

export type FallPiece = 'skid' | 'slide' | 'fly' | 'dust' | 'roll' | 'down' | 'sit';
const PNG = import.meta.glob('./assets/motofall/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const meta = META as Record<string, Record<FallPiece, { w: number; h: number; lamp?: number[] }>>;

const M = 144; // unidades do mundo por metro (no sentido da pista: KMH = 0,025 -> 1 m/s = 144 u/s)
const G = 9.81;
const SKID_T = 0.32; // s derrapando inclinada antes de o piloto sair
const MOTO_DEC = 0.8 * G * M; // moto deitada no asfalto (u/s²)
const ROLL_DEC = 1.3 * G * M; // piloto rolando (para alguns metros depois da moto)
const SPARK_V = 7 * M; // acima disso (u/s) a moto deitada solta faísca; abaixo, poeira
const SPRITE_M = 160 / 1.8; // pixels do sprite por metro (escala dos carros do trânsito)
const DUST_HOLD = 0.6; // s de poeira depois de parar

export interface MotoFall {
  rider: true;
  t: number; // s desde a batida
  dir: number; // lado da queda (1 direita, -1 esquerda: peças espelhadas)
  model: string; // custom | sport | pop
  // piloto: posição na pista (z, x), velocidades (u/s), altura (m) e velocidade vertical (m/s)
  z: number;
  x: number;
  v: number;
  vx: number;
  y: number;
  vy: number;
  stage: 'skid' | 'air' | 'roll' | 'sit';
  spin: number; // quanto a bola já girou (rad)
  stopT: number; // s desde que a moto parou (a poeira assenta)
}

// a batida: a moto começa a cair (c.speed/c.slide já vêm da batida)
export function startFall(c: TrafficCar, side: number) {
  c.hit = true;
  c.smoke = 0;
  c.dmg = undefined;
  c.signal = 0;
  const dir = Math.sign(c.slide) || -side || 1;
  c.fall = { rider: true, t: 0, dir, model: c.model.replace('moto-', ''), z: c.z, x: c.x, v: c.speed, vx: 0, y: 0, vy: 0, stage: 'skid', spin: 0, stopT: 0 };
}

// quem pode vir em cima do piloto sentado (jogador, rival, trânsito na mesma mão)
export interface Mover { z: number; x: number; speed: number }

export function updateFall(c: TrafficCar, dt: number, roadW: number, movers: Mover[]) {
  const f = c.fall!;
  f.t += dt;
  // moto: escorrega deitada até parar; de lado, perde o empurrão aos poucos
  const dec = f.t < SKID_T ? MOTO_DEC * 0.5 : MOTO_DEC;
  c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), dec * dt);
  c.x += c.slide * dt * (f.t < SKID_T ? 0.4 : 1);
  c.slide *= Math.exp(-2.4 * dt);
  const lim = roadW + CAR_W * 0.7;
  if (Math.abs(c.x) > lim) {
    c.x = Math.sign(c.x) * lim;
    c.slide = 0;
  }
  if (c.speed === 0) f.stopT += dt;
  if (f.stage === 'skid') {
    f.z = c.z;
    f.x = c.x;
    if (f.t >= SKID_T) {
      // o piloto sai por cima do guidão: mais rápido que a moto, para o lado da queda
      f.stage = 'air';
      f.v = c.speed + 1 * M;
      f.vx = c.slide * 0.6 + f.dir * CAR_W * 0.55;
      f.y = 0.7;
      f.vy = 3.4;
    }
    return;
  }
  f.z += f.v * dt;
  f.x += f.vx * dt;
  const rlim = roadW + CAR_W * 1.3; // pode parar no acostamento, nunca no mato longe
  if (Math.abs(f.x) > rlim) {
    f.x = Math.sign(f.x) * rlim;
    f.vx = 0;
  }
  if (f.stage === 'air') {
    f.vy -= G * dt;
    f.y += f.vy * dt;
    if (f.y <= 0) {
      f.y = 0;
      f.stage = 'roll';
    }
  } else if (f.stage === 'roll') {
    f.v -= Math.sign(f.v) * Math.min(Math.abs(f.v), ROLL_DEC * dt);
    f.vx *= Math.exp(-2.5 * dt);
    f.spin += (Math.abs(f.v) / M / 0.45) * dt;
    if (Math.abs(f.v) < 0.8 * M) {
      f.stage = 'sit';
      f.v = 0;
      f.vx = 0;
    }
  } else {
    // sentado tonto: se alguém vem em cima (vai chegar em menos de ~1 s), pula para o lado
    for (const o of movers) {
      const dz = f.z - o.z, closing = o.speed - f.v;
      if (dz > 0 && closing > 300 && dz < closing * 1.0 + SEG_LEN && Math.abs(o.x - f.x) < CAR_W * 0.95) {
        const away = Math.sign(f.x - o.x) || f.dir;
        // para o lado de longe do carro; se ali já é mato, para o outro lado dele
        let to = o.x + away * CAR_W * 1.15;
        if (Math.abs(to) > rlim) to = o.x - away * CAR_W * 1.15;
        f.stage = 'air';
        f.vy = 3.2;
        f.y = 0.05;
        f.vx = (to - f.x) / 0.62;
        f.v = 0;
        break;
      }
    }
  }
}

// ---- desenho ----
const img = (model: string, p: FallPiece) => PNG[`./assets/motofall/${model}-${p}.png`];
// peça da moto conforme a fase
export function motoPiece(c: TrafficCar): FallPiece {
  const f = c.fall!;
  if (f.t < SKID_T) return 'skid';
  if (Math.abs(c.speed) > SPARK_V) return 'slide';
  if (c.speed !== 0 || f.stopT < DUST_HOLD) return 'dust';
  return 'down';
}
const riderPiece = (f: MotoFall): FallPiece | null => (f.stage === 'skid' ? null : f.stage === 'air' ? 'fly' : f.stage === 'roll' ? 'roll' : 'sit');

// sombra chapada no chão (pixel art: faixas, sem degradê liso)
function shadow(g: CanvasRenderingContext2D, x: number, y: number, w: number, a = 0.35) {
  const rows = Math.max(1, Math.round(w * 0.05));
  for (let k = 0; k < rows; k++) {
    const hw = (w / 2) * Math.sqrt(1 - (k / rows) ** 2);
    g.fillStyle = `rgba(0,0,0,${(a * (1 - k / (rows + 1))).toFixed(3)})`;
    g.fillRect(Math.round(x - hw), Math.round(y) - Math.ceil(rows / 2) + k, Math.round(hw * 2), 1);
  }
}

// desenha a peça com a base em (x, y); px = pixels de tela por pixel do sprite; flip espelha
function piece(g: CanvasRenderingContext2D, model: string, p: FallPiece, x: number, y: number, px: number, flip: boolean, rot = 0) {
  const m = meta[model]?.[p], src = img(model, p);
  if (!m || !src) return null;
  const w = m.w * px, h = m.h * px;
  if (w < 1) return null;
  // rasterizado na resolução real da tela (como os carros grandes): nítido, sem borrar ao ampliar
  const spr = svgSprite(src, w * RES, h * RES);
  if (!spr) return null;
  const L = Math.round(x - w / 2), T = Math.round(y - h);
  if (!flip && !rot) g.drawImage(spr, L, T, Math.round(w), Math.round(h));
  else {
    g.save();
    g.translate(Math.round(x), Math.round(y - (rot ? h / 2 : 0)));
    if (rot) g.rotate(rot);
    if (flip) g.scale(-1, 1);
    g.drawImage(spr, -Math.round(w / 2), rot ? -Math.round(h / 2) : -Math.round(h), Math.round(w), Math.round(h));
    g.restore();
  }
  return { w, h, lamp: m.lamp };
}

// moto caída (ou derrapando, com o piloto ainda em cima). (x, y) = chão; px = pixels de tela por pixel
// do sprite; mirror = vista do retrovisor (vista pelo outro lado: espelhada)
export function drawFallMoto(g: CanvasRenderingContext2D, x: number, y: number, px: number, c: TrafficCar, night: boolean, mirror = false) {
  const f = c.fall!;
  const p = motoPiece(c), m = meta[f.model]?.[p];
  if (!m) return;
  const flip = (f.dir < 0) !== mirror;
  shadow(g, x, y, m.w * px * (p === 'skid' ? 0.55 : 0.8));
  const d = piece(g, f.model, p, x, y, px, flip);
  if (!d || !night || mirror || !d.lamp) return;
  // lanterna acesa (a moto caída continua com a luz de trás) e o recorte da luz de quem está atrás
  const u = flip ? 1 - d.lamp[0] : d.lamp[0];
  const L = x - d.w / 2, T = y - d.h, r = Math.max(1, Math.round(d.w * 0.05));
  g.fillStyle = 'rgba(255,60,40,0.6)';
  g.fillRect(Math.round(L + u * d.w - r / 2), Math.round(T + d.lamp[1] * d.h - r / 2), r, r);
  const tf = g.getTransform();
  const look: CarLook = { color: '#000', night: true, front: false };
  pushCarLights(x, y, d.w, look, { h: d.h, dots: [[u, d.lamp[1]]] }, (o, game) => {
    o.save();
    if (!game) o.setTransform(tf);
    piece(o, f.model, p, x, y, px, flip);
    o.restore();
  });
}

// piloto (no ar, rolando ou sentado). (x, y) = chão embaixo dele
export function drawFallRider(g: CanvasRenderingContext2D, x: number, y: number, px: number, f: MotoFall, mirror = false) {
  const p = riderPiece(f);
  if (!p) return;
  const m = meta[f.model]?.[p];
  if (!m) return;
  const flip = (f.dir < 0) !== mirror;
  const lift = f.y * SPRITE_M * px; // altura no ar, na escala do sprite
  shadow(g, x, y, m.w * px * (p === 'fly' ? Math.max(0.3, 0.7 - f.y * 0.25) : 0.75), p === 'fly' ? 0.25 : 0.35);
  // rolando: a bola gira em quartos de volta (rotação exata de pixel art)
  const rot = p === 'roll' ? Math.floor(f.spin / (Math.PI / 2)) * (Math.PI / 2) * (flip ? -1 : 1) : 0;
  piece(g, f.model, p, x, y - lift, px, flip, rot);
}

// tamanho na tela de um pixel do sprite, dada a largura de tela de um carro (CAR_W)
export const fallPx = (carWpx: number) => carWpx / 160;
