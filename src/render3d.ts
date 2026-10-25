import { CAM_DEPTH, CAM_H, CAR_W, DRAW_DIST, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { drawCar } from './cars';
import type { Race, TrafficCar } from './race';
import { SPRITES } from './sprites';
import type { BgLayer } from './themes';
import type { Point, Segment } from './track';
import { dither } from './ui';
import { lerp, shade } from './util';

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
  horizon: number; // y do horizonte
  K: number; // escala da projeção em pixels
}

function project(p: Point, camX: number, camY: number, camZ: number, roadW: number, vp: Viewport) {
  p.camera.x = -camX;
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

function drawLayer(c: CanvasRenderingContext2D, kind: BgLayer, color: string, off: number, vp: Viewport, base: number, amp: number, night: boolean) {
  const step = 2;
  for (let x = 0; x < vp.w; x += step) {
    const wx = x + off;
    let top: number;
    switch (kind) {
      case 'city': {
        const col = Math.floor(wx / 12);
        const hgt = hash(col) < 0.2 ? 0 : 0.25 + hash(col + 7) * 0.75;
        top = base - amp * 1.4 * hgt;
        if (hgt > 0) {
          c.fillStyle = shade(color, (hash(col + 3) - 0.5) * 0.3);
          c.fillRect(vp.x + x, top, step, base - top + 1);
          // janelas
          if ((Math.floor(wx) % 4) < 2) {
            c.fillStyle = night ? (hash(col * 3) > 0.4 ? '#ffd86b' : '#2a2a40') : '#dfe8f4';
            for (let yy = top + 3; yy < base - 2; yy += 4) if (hash(col * 31 + yy) > 0.35) c.fillRect(vp.x + x, yy, 1, 2);
          }
          continue;
        }
        top = base;
        break;
      }
      case 'forest':
        top = base - amp * (0.35 + 0.12 * Math.sin(wx * 0.9) * Math.sin(wx * 0.23) + 0.18 * hash(Math.floor(wx / 3)));
        break;
      case 'mesa': {
        const m = Math.sin(wx * 0.012) * 0.5 + Math.sin(wx * 0.031 + 1) * 0.3;
        top = base - amp * (m > 0.05 ? 0.75 + 0.08 * Math.sin(wx * 0.4) + 0.06 * hash(Math.floor(wx)) : 0.2 + m);
        break;
      }
      case 'hills':
        top = base - amp * (0.4 + 0.25 * Math.sin(wx * 0.015) + 0.15 * Math.sin(wx * 0.041 + 2));
        break;
      case 'snowpeaks': {
        const p = Math.abs(((wx * 0.02) % 2) - 1);
        top = base - amp * (0.3 + 0.7 * (1 - p) * (0.6 + 0.4 * hash(Math.floor(wx * 0.02))));
        c.fillStyle = color;
        c.fillRect(vp.x + x, top, step, base - top + 1);
        c.fillStyle = night ? '#8a96aa' : '#f4f8fc';
        c.fillRect(vp.x + x, top, step, Math.max(0, (base - top) * 0.25));
        continue;
      }
      case 'dunes':
        top = base - amp * (0.2 + 0.1 * Math.sin(wx * 0.02));
        break;
      case 'sea':
        top = base - amp * 0.12;
        break;
    }
    c.fillStyle = color;
    c.fillRect(vp.x + x, top, step, base - top + 1);
  }
}

function drawBackground(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const th = r.theme;
  const grad = c.createLinearGradient(0, vp.y, 0, vp.horizon);
  grad.addColorStop(0, th.sky[0]);
  grad.addColorStop(1, th.sky[1]);
  c.fillStyle = grad;
  c.fillRect(vp.x, vp.y, vp.w, vp.horizon - vp.y + 2);
  if (r.def.night) {
    c.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const sx = ((hash(i) * 900 - r.bgOffset * 0.1) % vp.w + vp.w) % vp.w;
      c.fillRect(vp.x + sx, vp.y + hash(i + 50) * (vp.horizon - vp.y) * 0.8, 1, 1);
    }
    c.fillStyle = '#fff4c8';
    c.beginPath();
    c.arc(vp.x + vp.w * 0.78, vp.y + 14, 6, 0, Math.PI * 2);
    c.fill();
  }
  const [far, near] = th.bg;
  const amp = (vp.horizon - vp.y) * 0.75;
  drawLayer(c, far, th.bgColors[0], r.bgOffset * 0.3, vp, vp.horizon, amp, !!r.def.night);
  drawLayer(c, near, th.bgColors[1], r.bgOffset * 0.6, vp, vp.horizon, amp * 0.4, !!r.def.night);
}

export function renderRoad(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const segs = r.track.segments;
  const roadW = r.track.roadW;
  const night = !!r.def.night;
  c.save();
  c.beginPath();
  c.rect(vp.x, vp.y, vp.w, vp.h);
  c.clip();
  if (r.shake) c.translate(Math.round((Math.random() - 0.5) * 2), Math.round((Math.random() - 0.5) * 2));
  drawBackground(c, r, vp);

  const base = r.findSegment(r.position);
  const basePct = (r.position % SEG_LEN) / SEG_LEN;
  const pSeg = r.findSegment(r.playerZ);
  const pPct = (r.playerZ % SEG_LEN) / SEG_LEN;
  const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
  const end = Math.min(segs.length, base.index + DRAW_DIST);
  const ground = dither(c, r.theme.ground[0], r.theme.ground[1]);
  // chão por baixo de tudo: em vales, parte da tela não é coberta por nenhum segmento
  c.fillStyle = ground;
  c.fillRect(vp.x, vp.horizon, vp.w, vp.y + vp.h - vp.horizon);

  for (let i = base.index; i < end; i++) segs[i].cars.length = 0;
  const entities: { z: number; x: number }[] = [...r.traffic, ...r.police.filter((p) => p.state !== 'done' || Math.abs(p.z - r.playerZ) < 100 * SEG_LEN)];
  if (r.rival) entities.push(r.rival);
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
    project(s.p1, r.x - x, playerY + CAM_H, r.position, roadW, vp);
    project(s.p2, r.x - x - dx, playerY + CAM_H, r.position, roadW, vp);
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
      if (dist > (sp.kind === 'post' ? 90 : sp.kind === 'building' || sp.kind === 'station' ? 400 : 170)) continue;
      const def = SPRITES[sp.kind];
      const sc = s.p1.screen.scale;
      const sw = def.w * sc * vp.K;
      const sh = def.h * sc * vp.K;
      const sx = s.p1.screen.x + sc * sp.x * vp.K;
      if (sx + sw / 2 < vp.x || sx - sw / 2 > vp.x + vp.w || sw < 1.2) continue;
      def.draw(c, sx, s.p1.screen.y, sw, sh, sp.seed);
    }
    for (const e of s.cars) {
      if (e.z - r.position < 1300) continue; // colado no para-brisa: some sob o painel
      const pct = (e.z % SEG_LEN) / SEG_LEN;
      const sc = lerp(s.p1.screen.scale, s.p2.screen.scale, pct);
      const cy = lerp(s.p1.screen.y, s.p2.screen.y, pct);
      const baseX = lerp(s.p1.screen.x, s.p2.screen.x, pct);
      const ex = e.x;
      const cx = baseX + sc * ex * vp.K;
      if (e === r.rival) {
        drawCar(c, cx, cy, CAR_W * sc * vp.K, { color: r.rivalCar!.color, wing: r.rivalCar!.wing, brake: r.rival.recover > 0, night });
      } else if ('spotZ' in e) {
        const p = e as Race['police'][number];
        drawCar(c, cx, cy, POLICE_W * sc * vp.K, { color: '#fff', police: true, siren: p.state === 'chase', night });
      } else {
        const t = e as TrafficCar;
        drawCar(c, cx, cy, (t.truck ? TRUCK_W : CAR_W) * sc * vp.K, { color: t.color, front: t.speed < 0, truck: t.truck, night });
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

  const D = 900;
  const behind: { z: number; x: number; w: number; look: Parameters<typeof drawCar>[4] }[] = [];
  const night = !!r.def.night;
  for (const t of r.traffic) behind.push({ z: t.z, x: t.x, w: t.truck ? TRUCK_W : CAR_W, look: { color: t.color, front: t.speed > 0, truck: t.truck, night } });
  if (r.rival) behind.push({ z: r.rival.z, x: r.rival.x, w: CAR_W, look: { color: r.rivalCar!.color, front: true, night } });
  for (const p of r.police) if (p.state === 'chase') behind.push({ z: p.z, x: p.x, w: POLICE_W, look: { color: '#fff', police: true, siren: true, front: true, night } });
  behind.sort((a, b) => a.z - b.z);
  for (const b of behind) {
    const dz = r.position - b.z;
    if (dz < 300 || dz > 60 * SEG_LEN) continue;
    const k = D / dz;
    const yy = hz + (bottom - hz) * Math.min(1, k);
    drawCar(c, cx + (b.x - r.x) * sb * k, yy, b.w * sb * k, b.look);
  }
  c.restore();
}
