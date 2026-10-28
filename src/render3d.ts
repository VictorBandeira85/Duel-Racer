import { drawCrisp } from './crisp';
import { CAM_DEPTH, CAM_H, CAR_W, DRAW_DIST, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { drawCar } from './cars';
import type { Officer, Race, TrafficCar } from './race';
import { SPRITES } from './sprites';
import type { BgLayer } from './themes';
import type { Point, Segment } from './track';
import { dither } from './ui';
import { PANO_H, PANO_W, panorama } from './bgart';
import { lerp, shade } from './util';

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
  horizon: number; // y do horizonte
  K: number; // escala da projeção em pixels
}

const OFFICER_H = 1050; // altura do policial (unidades do mundo)

// Policial visto de frente: quepe, óculos escuros, camisa azul. (x, y) = pés.
function drawOfficer(c: CanvasRenderingContext2D, x: number, y: number, h: number, paper: boolean) {
  if (h < 3) return;
  const w = h * 0.36;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(x - w * 0.6, y - h * 0.02, w * 1.2, h * 0.03);
  c.fillStyle = '#1c2440';
  c.fillRect(x - w * 0.42, y - h * 0.46, w * 0.38, h * 0.44);
  c.fillRect(x + w * 0.04, y - h * 0.46, w * 0.38, h * 0.44);
  c.fillStyle = '#0c0c0c';
  c.fillRect(x - w * 0.46, y - h * 0.03, w * 0.42, h * 0.03);
  c.fillRect(x + w * 0.04, y - h * 0.03, w * 0.42, h * 0.03);
  c.fillStyle = '#5a7ac8';
  c.fillRect(x - w / 2, y - h * 0.82, w, h * 0.38);
  c.fillRect(x - w * 0.72, y - h * 0.8, w * 0.24, h * 0.3);
  c.fillRect(x + w * 0.48, y - h * 0.8, w * 0.24, h * 0.3);
  c.fillStyle = '#e0b088';
  c.fillRect(x - w * 0.7, y - h * 0.52, w * 0.2, h * 0.06);
  c.fillStyle = '#141414';
  c.fillRect(x - w / 2, y - h * 0.48, w, h * 0.04);
  c.fillStyle = '#e8c018';
  c.fillRect(x - w * 0.32, y - h * 0.76, w * 0.12, h * 0.05);
  if (paper) {
    c.fillStyle = '#f6f2e6';
    c.fillRect(x + w * 0.3, y - h * 0.7, w * 0.5, h * 0.22);
  } else {
    c.fillStyle = '#e0b088';
    c.fillRect(x + w * 0.5, y - h * 0.52, w * 0.2, h * 0.06);
  }
  c.fillStyle = '#e0b088';
  c.fillRect(x - w * 0.1, y - h * 0.86, w * 0.2, h * 0.05);
  c.beginPath();
  c.arc(x, y - h * 0.9, w * 0.26, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#101010';
  c.fillRect(x - w * 0.22, y - h * 0.92, w * 0.44, h * 0.03);
  c.fillStyle = '#1c2440';
  c.fillRect(x - w * 0.3, y - h * 1.0, w * 0.6, h * 0.07);
  c.fillRect(x - w * 0.36, y - h * 0.95, w * 0.72, h * 0.025);
  c.fillStyle = '#e8c018';
  c.fillRect(x - w * 0.05, y - h * 0.985, w * 0.1, h * 0.035);
}

// yaw: carro atravessado, a câmera gira (desloca mais quanto mais longe)
function project(p: Point, camX: number, camY: number, camZ: number, roadW: number, vp: Viewport, yaw = 0) {
  p.camera.x = -camX - yaw * (p.world.z - camZ);
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;
  const s = CAM_DEPTH / p.camera.z;
  p.screen.scale = s;
  p.screen.x = Math.round(vp.x + vp.w / 2 + s * p.camera.x * vp.K);
  p.screen.y = Math.round(vp.horizon - s * p.camera.y * vp.K);
  p.screen.w = Math.round(s * roadW * vp.K);
}

function quad(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.lineTo(x3, y3);
  c.lineTo(x4, y4);
  c.closePath();
  c.fill();
}

// faixa central/divisórias: tracejado a cada 4 segmentos
function laneLine(c: CanvasRenderingContext2D, s: Segment, at: number, width: number, color: string) {
  const { x: x1, y: y1, w: w1 } = s.p1.screen;
  const { x: x2, y: y2, w: w2 } = s.p2.screen;
  const l1 = Math.max(0.5, w1 * width), l2 = Math.max(0.5, w2 * width);
  c.fillStyle = color;
  quad(c, x1 + at * w1 - l1, y1, x1 + at * w1 + l1, y1, x2 + at * w2 + l2, y2, x2 + at * w2 - l2, y2);
}

function drawSegment(c: CanvasRenderingContext2D, s: Segment, r: Race, vp: Viewport, ground: CanvasPattern) {
  const th = r.theme;
  const { x: x1, y: y1, w: w1 } = s.p1.screen;
  const { x: x2, y: y2, w: w2 } = s.p2.screen;
  c.fillStyle = ground;
  c.fillRect(vp.x, y2, vp.w, y1 - y2);
  const sh1 = w1 * 0.1, sh2 = w2 * 0.1;
  c.fillStyle = th.shoulder;
  quad(c, x1 - w1 - sh1, y1, x1 + w1 + sh1, y1, x2 + w2 + sh2, y2, x2 - w2 - sh2, y2);
  c.fillStyle = th.road;
  quad(c, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
  const dash = (s.index >> 2) & 1;
  if (r.track.lanes === 2) {
    if (dash) laneLine(c, s, 0, 0.025, '#f2c81e');
  } else {
    laneLine(c, s, -0.018, 0.009, '#f2c81e');
    laneLine(c, s, 0.018, 0.009, '#f2c81e');
    if (dash) {
      laneLine(c, s, -0.5, 0.014, '#e8e8e8');
      laneLine(c, s, 0.5, 0.014, '#e8e8e8');
    }
  }
}

function hash(n: number) {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

function drawBackground(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const th = r.theme;
  const night = !!r.def.night;
  const yawPx = CAM_DEPTH * r.yaw * vp.K; // carro atravessado: o fundo gira junto com a pista
  // céu em faixas, do tom de cima até o do horizonte (com uma linha pontilhada em cada emenda)
  const top = vp.y, hz = vp.horizon + 2, bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.round(top + ((hz - top) * i) / bands), y1 = Math.round(top + ((hz - top) * (i + 1)) / bands);
    const col = mix(th.sky[0], th.sky[1], i / (bands - 1));
    c.fillStyle = col;
    c.fillRect(vp.x, y0, vp.w, y1 - y0);
    if (i > 0) {
      c.fillStyle = dither(c, col, mix(th.sky[0], th.sky[1], (i - 1) / (bands - 1)));
      c.fillRect(vp.x, y0, vp.w, 1);
    }
  }
  if (night) {
    c.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const sx = ((hash(i) * 900 - r.bgOffset * 0.1 - yawPx) % vp.w + vp.w) % vp.w;
      c.fillRect(vp.x + Math.floor(sx), vp.y + Math.floor(hash(i + 50) * (vp.horizon - vp.y) * 0.7), 1, 1);
    }
    c.fillStyle = '#fff4c8';
    c.beginPath();
    c.arc(vp.x + vp.w * 0.78, vp.y + 12, 5, 0, Math.PI * 2);
    c.fill();
  }
  const seed = r.course.id.length * 31 + r.stageIdx;
  const [far, near] = th.bg;
  const layer = (kind: BgLayer, isNear: boolean, speed: number) => {
    const img = panorama(kind, isNear, night, seed);
    const off = ((Math.floor(r.bgOffset * speed + yawPx) % PANO_W) + PANO_W) % PANO_W;
    const y = vp.horizon - PANO_H + 1;
    c.drawImage(img, vp.x - off, y);
    if (PANO_W - off < vp.w) c.drawImage(img, vp.x - off + PANO_W, y);
  };
  layer(far, false, 0.3);
  layer(near, true, 0.6);
}

// mistura de duas cores #rrggbb
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// objetos grandes, que aparecem de longe
const FAR_KINDS = ['building', 'station', 'bridge', 'billboard', 'barn', 'factory', 'silo', 'spire', 'lighthouse'];

export function renderRoad(c: CanvasRenderingContext2D, r: Race, view0: Viewport) {
  // câmera inclinada junto com o carro: na subida o horizonte desce, na descida sobe
  const vp = { ...view0, horizon: view0.horizon + Math.round(Math.max(-40, Math.min(40, r.pitch * CAM_DEPTH * view0.K))) };
  const segs = r.track.segments;
  const roadW = r.track.roadW;
  const night = !!r.def.night;
  c.save();
  c.beginPath();
  c.rect(vp.x, vp.y, vp.w, vp.h);
  c.clip();
  // topo de lombada: a câmera sobe um pouco (o carro alivia)
  if (r.air > 0.15) c.translate(0, -Math.round(r.air * 4));
  if (r.shake) c.translate(Math.round((Math.random() - 0.5) * 2), Math.round((Math.random() - 0.5) * 2));
  // sensação de velocidade: perto da máxima a imagem trepida de leve (1 px, de vez em quando)
  else if (r.speed > r.car.maxSpeed * 0.8 && Math.random() < (r.speed / r.car.maxSpeed - 0.8) * 2.5) c.translate(0, Math.random() < 0.5 ? 1 : -1);
  drawBackground(c, r, vp);

  const base = r.findSegment(r.position);
  const basePct = (r.position % SEG_LEN) / SEG_LEN;
  // altura da câmera: o chão logo abaixo do motorista
  const playerY = lerp(base.p1.world.y, base.p2.world.y, basePct);
  const end = Math.min(segs.length, base.index + DRAW_DIST);
  const ground = dither(c, r.theme.ground[0], r.theme.ground[1]);
  // chão por baixo de tudo: em vales, parte da tela não é coberta por nenhum segmento
  c.fillStyle = ground;
  c.fillRect(vp.x, vp.horizon, vp.w, vp.y + vp.h - vp.horizon);

  for (let i = base.index; i < end; i++) segs[i].cars.length = 0;
  const entities: { z: number; x: number }[] = [...r.traffic, ...r.police.filter((p) => p.state !== 'done' || Math.abs(p.z - r.playerZ) < 100 * SEG_LEN)];
  if (r.rival) entities.push(r.rival);
  if (r.officer) entities.push(r.officer);
  for (const e of entities) {
    const idx = Math.floor(e.z / SEG_LEN);
    if (idx >= base.index && idx < end) segs[idx].cars.push(e);
  }

  let maxy = vp.y + vp.h;
  let x = 0;
  let dx = -(base.curve * basePct);
  for (let i = base.index; i < end; i++) {
    const s = segs[i];
    s.clip = maxy;
    project(s.p1, r.x - x, playerY + CAM_H, r.position, roadW, vp, r.yaw);
    project(s.p2, r.x - x - dx, playerY + CAM_H, r.position, roadW, vp, r.yaw);
    x += dx;
    dx += s.curve;
    if (s.p1.camera.z <= CAM_DEPTH || s.p2.screen.y >= s.p1.screen.y || s.p2.screen.y >= maxy) continue;
    drawSegment(c, s, r, vp, ground);
    maxy = s.p1.screen.y;
  }

  for (let i = end - 1; i > base.index; i--) {
    const s = segs[i];
    if (s.p1.camera.z <= CAM_DEPTH * 4) continue;
    c.save();
    c.beginPath();
    c.rect(vp.x, vp.y, vp.w, s.clip - vp.y);
    c.clip();
    const dist = i - base.index;
    for (const sp of s.sprites) {
      // objetos pequenos e distantes só poluem o horizonte
      if (dist > (sp.kind === 'post' || sp.kind === 'rail' ? 90 : FAR_KINDS.includes(sp.kind) ? 400 : 170)) continue;
      const def = SPRITES[sp.kind];
      const sc = s.p1.screen.scale;
      const sw = def.w * sc * vp.K;
      const sh = def.h * sc * vp.K;
      const sx = s.p1.screen.x + sc * sp.x * vp.K;
      if (sx + sw / 2 < vp.x || sx - sw / 2 > vp.x + vp.w || sw < 1.2) continue;
      // desenhado como pixel art nítida (sem antialias, com contorno); a caixa é um pouco
      // mais larga que o objeto para caber o que passa da largura (braço do poste etc.)
      const seed = sp.kind === 'building' ? sp.seed % 45 : sp.kind === 'house' || sp.kind === 'billboard' ? sp.seed % 6 : sp.kind === 'autumn' || sp.kind === 'umbrella' ? sp.seed % 3 : 0;
      const bw = sw * (sp.kind === 'lamp' ? 3.4 : 1.1);
      drawCrisp(c, `${sp.kind}${seed}`, sx, s.p1.screen.y, bw, sh, (o, w, h) => def.draw(o, w / 2, h, (w * sw) / bw, h, seed));
    }
    for (const e of s.cars) {
      if (e.z - r.position < 450) continue; // colado no para-brisa: some sob o painel
      const pct = (e.z % SEG_LEN) / SEG_LEN;
      const sc = lerp(s.p1.screen.scale, s.p2.screen.scale, pct);
      const cy = lerp(s.p1.screen.y, s.p2.screen.y, pct);
      const baseX = lerp(s.p1.screen.x, s.p2.screen.x, pct);
      const ex = e.x;
      const cx = baseX + sc * ex * vp.K;
      if (e === r.rival) {
        drawCar(c, cx, cy, CAR_W * sc * vp.K, { color: r.rivalCar!.color, rear: r.rivalCar!.rear, brake: r.rival.recover > 0 || r.rival.mistake > 0, night, paint: r.rivalPaint, signal: r.rival.signal });
      } else if ('phase' in e) {
        drawOfficer(c, cx, cy, OFFICER_H * sc * vp.K, (e as Officer).phase === 'show');
      } else if ('spotZ' in e) {
        const p = e as Race['police'][number];
        const siren = p.state === 'chase' || p.state === 'pull' || p.state === 'stopped';
        drawCar(c, cx, cy, (p.sv ? CAR_W * 1.08 : POLICE_W) * sc * vp.K, { color: '#fff', police: true, sv: p.sv, siren, night });
      } else {
        const t = e as TrafficCar;
        drawCar(c, cx, cy, (t.truck ? TRUCK_W : CAR_W) * sc * vp.K, { color: t.color, front: t.speed < 0, truck: t.truck, night, model: t.model, signal: t.signal, flash: t.panic > 0.4 && Math.floor(performance.now() / 160) % 2 === 0 });
      }
    }
    c.restore();
  }

  // escuridão da noite: faróis iluminam só a frente
  if (night) {
    const g = c.createRadialGradient(vp.x + vp.w / 2, vp.y + vp.h * 1.05, vp.h * 0.2, vp.x + vp.w / 2, vp.y + vp.h, vp.w * 0.6);
    g.addColorStop(0, 'rgba(0,0,10,0)');
    g.addColorStop(1, 'rgba(0,0,10,0.55)');
    c.fillStyle = g;
    c.fillRect(vp.x, vp.horizon, vp.w, vp.y + vp.h - vp.horizon);
  }
  c.restore();
}

// Retrovisor: visão simplificada da estrada atrás (rival, polícia, trânsito)
export function renderMirror(c: CanvasRenderingContext2D, r: Race, x: number, y: number, w: number, h: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const hz = y + h * 0.42;
  c.fillStyle = r.theme.sky[1];
  c.fillRect(x, y, w, hz - y);
  c.fillStyle = dither(c, r.theme.ground[0], r.theme.ground[1]);
  c.fillRect(x, hz, w, y + h - hz);
  const cx = x + w / 2;
  const bottom = y + h;
  const sb = (w * 0.42) / r.track.roadW;
  const at = (wx: number) => cx + (wx - r.x) * sb;
  c.fillStyle = r.theme.road;
  quad(c, at(-r.track.roadW), bottom, at(r.track.roadW), bottom, cx + 1, hz, cx - 1, hz);
  c.strokeStyle = '#f2c81e';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(at(0), bottom);
  c.lineTo(cx, hz);
  c.stroke();

  // espelho plano, campo estreito: quem fica para trás continua visível por mais tempo
  const D = 2000;
  const behind: { z: number; x: number; w: number; look: Parameters<typeof drawCar>[4] }[] = [];
  const night = !!r.def.night;
  for (const t of r.traffic) behind.push({ z: t.z, x: t.x, w: t.truck ? TRUCK_W : CAR_W, look: { color: t.color, front: t.speed > 0, truck: t.truck, night, model: t.model } });
  if (r.rival) behind.push({ z: r.rival.z, x: r.rival.x, w: CAR_W, look: { color: r.rivalCar!.color, rear: r.rivalCar!.rear, front: true, night, paint: r.rivalPaint, signal: r.rival.signal, lamps: r.rivalLamps() } });
  for (const p of r.police) if (p.state === 'chase' || p.state === 'pull') behind.push({ z: p.z, x: p.x, w: p.sv ? CAR_W * 1.08 : POLICE_W, look: { color: '#fff', police: true, sv: p.sv, siren: true, front: true, night } });
  behind.sort((a, b) => a.z - b.z);
  for (const b of behind) {
    const dz = r.position - b.z;
    if (dz < 300 || dz > 130 * SEG_LEN) continue;
    const k = D / dz;
    const yy = hz + (bottom - hz) * Math.min(1, k);
    const bw = b.w * sb * k;
    if (bw < 2) { // bem longe: um pontinho (os faróis, à noite)
      c.fillStyle = night && b.look.front ? '#fff6c0' : b.look.color;
      c.fillRect(Math.round(cx + (b.x - r.x) * sb * k - 0.5), Math.round(yy - 1), 1, 1);
      continue;
    }
    drawCar(c, cx + (b.x - r.x) * sb * k, yy, bw, b.look);
  }
  c.restore();
}
