import { DASH_Y, KMH, ROOF_H, view } from './config';
import type { Race } from './race';
import { renderMirror, renderRoad, type Viewport } from './render3d';
import { dither, text } from './ui';
import { formatTime, lerp, rng, shade } from './util';

let wheelAngle = 0;
let crackKey = -1;
let cracks: number[][] = [];
const drops: { x: number; y: number; v: number }[] = [];

export function windshield(): Viewport {
  const h = DASH_Y - ROOF_H;
  return { x: 0, y: ROOF_H, w: view.w, h, horizon: ROOF_H + Math.round(h * 0.44), K: 215 };
}

function gauge(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  labels: string[], frac: number, redFrom: number, digital?: string, gear?: string,
) {
  c.fillStyle = '#8a8a8a';
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#0c0c0c';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ticks = (labels.length - 1) * 2;
  for (let i = 0; i <= ticks; i++) {
    const f = i / ticks;
    const a = a0 + sweep * f;
    const r1 = i % 2 ? r * 0.86 : r * 0.78;
    c.strokeStyle = f >= redFrom ? '#ff3030' : '#f0f0f0';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    c.stroke();
  }
  c.font = 'bold 6px monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  labels.forEach((l, i) => {
    const f = i / (labels.length - 1);
    const a = a0 + sweep * f;
    c.fillStyle = f >= redFrom ? '#ff4040' : '#f0f0f0';
    c.fillText(l, cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
  });
  if (digital) {
    c.fillStyle = '#ff5030';
    c.fillText(digital, cx, cy + r * 0.62);
  }
  if (gear) text(c, gear, cx + r * 0.42, cy + r * 0.3, 8, '#ff3030', 'center', null);
  const a = a0 + sweep * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = '#ff3a1a';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
  c.stroke();
  c.fillStyle = '#c03020';
  c.beginPath();
  c.arc(cx, cy, 2.5, 0, Math.PI * 2);
  c.fill();
}

function smallGauge(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number) {
  c.fillStyle = '#7a7a7a';
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#101010';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#e0e0e0';
  c.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (0.8 + i * 0.233);
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
    c.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    c.stroke();
  }
  const a = Math.PI * (0.8 + frac * 1.4);
  c.strokeStyle = '#ff3a1a';
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
  c.stroke();
}

function radarBox(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, level: number) {
  c.fillStyle = '#9a9a9a';
  c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = '#161616';
  c.fillRect(x, y, w, h);
  text(c, 'RADAR', x + w / 2, y + 3, 5, '#888', 'center', null);
  const n = 5;
  const lw = (w - 8) / n;
  const blink = level >= 1 && Math.floor(performance.now() / 150) % 2;
  for (let i = 0; i < n; i++) {
    const on = level > i / n && !blink;
    const col = i < 2 ? '#30e060' : i < 4 ? '#ffcc00' : '#ff3030';
    c.fillStyle = on ? col : shade(col, -0.55);
    c.fillRect(x + 4 + i * lw, y + h - 10, lw - 2, 6);
  }
}

function shifter(c: CanvasRenderingContext2D, x: number, y: number, gear: number) {
  c.fillStyle = '#9a9a9a';
  c.fillRect(x - 15, y - 22, 30, 44);
  c.fillStyle = '#1a1a1a';
  c.fillRect(x - 13, y - 20, 26, 40);
  // grade em H (5 marchas)
  c.fillStyle = '#d8d8d8';
  for (const gx of [-8, 0, 8]) c.fillRect(x + gx - 1, y - 14, 2, 28);
  c.fillRect(x - 8, y - 1, 16, 2);
  const pos = [[-8, -14], [-8, 14], [0, -14], [0, 14], [8, -14]][gear];
  c.fillStyle = '#c8c8c8';
  c.beginPath();
  c.arc(x + pos[0], y + pos[1] * 0.85, 5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(x + pos[0] - 2, y + pos[1] * 0.85 - 3, 2, 2);
}

function drawCracks(c: CanvasRenderingContext2D, r: Race, vp: Viewport, alpha: number) {
  if (crackKey !== r.crashes) {
    crackKey = r.crashes;
    const rand = rng(r.crashes * 77 + 3);
    cracks = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
      const line = [0, 0];
      let px = 0, py = 0;
      const len = 40 + rand() * 120;
      for (let d = 0; d < len; d += 8 + rand() * 10) {
        px += Math.cos(a + (rand() - 0.5) * 0.6) * 12;
        py += Math.sin(a + (rand() - 0.5) * 0.6) * 9;
        line.push(px, py);
      }
      cracks.push(line);
    }
  }
  const ox = vp.x + vp.w * r.crashPoint.x, oy = vp.y + vp.h * r.crashPoint.y;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = 'rgba(220,230,240,0.25)';
  c.fillRect(vp.x, vp.y, vp.w, vp.h);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1;
  for (const l of cracks) {
    c.beginPath();
    for (let i = 0; i < l.length; i += 2) c.lineTo(ox + l[i], oy + l[i + 1]);
    c.stroke();
  }
  for (const rr of [10, 22, 38]) {
    c.beginPath();
    c.ellipse(ox, oy, rr * 1.3, rr, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

function weather(c: CanvasRenderingContext2D, r: Race, vp: Viewport, dt: number) {
  const w = r.def.weather;
  if (!w) return;
  const n = w === 'rain' ? 70 : 60;
  while (drops.length < n) drops.push({ x: Math.random() * vp.w, y: Math.random() * vp.h, v: 0.6 + Math.random() * 0.6 });
  const sp = r.speed / r.car.maxSpeed;
  c.save();
  c.beginPath();
  c.rect(vp.x, vp.y, vp.w, vp.h);
  c.clip();
  if (w === 'rain') {
    c.strokeStyle = 'rgba(200,215,235,0.55)';
    c.lineWidth = 1;
    for (const d of drops) {
      d.y += dt * 260 * d.v;
      d.x -= dt * (40 + sp * 120) * d.v;
      if (d.y > vp.h || d.x < 0) { d.y = -5; d.x = Math.random() * (vp.w + 60); }
      c.beginPath();
      c.moveTo(vp.x + d.x, vp.y + d.y);
      c.lineTo(vp.x + d.x - 3, vp.y + d.y + 7);
      c.stroke();
    }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.9)';
    const cx = vp.w / 2, cy = vp.horizon - vp.y;
    for (const d of drops) {
      d.y += dt * (25 + sp * 60) * d.v + (d.y - cy) * dt * sp * 1.5;
      d.x += (d.x - cx) * dt * sp * 1.5;
      if (d.y > vp.h || d.x < 0 || d.x > vp.w) { d.x = cx + (Math.random() - 0.5) * vp.w * 0.8; d.y = cy + (Math.random() - 0.7) * 40; }
      const s = d.v > 1 ? 2 : 1;
      c.fillRect(vp.x + d.x, vp.y + d.y, s, s);
    }
  }
  c.restore();
}

export function renderCockpit(c: CanvasRenderingContext2D, r: Race, lives: number, stageLabel: string, totalTime: number, dt: number) {
  const { w, h } = view;
  const vp = windshield();
  renderRoad(c, r, vp);
  weather(c, r, vp, dt);
  if (r.state === 'crash') {
    const t = 2.6 - r.timer;
    drawCracks(c, r, vp, 1);
    if (t > 1.3) {
      c.fillStyle = `rgba(0,0,0,${Math.min(0.75, (t - 1.3) * 0.8)})`;
      c.fillRect(vp.x, vp.y, vp.w, vp.h);
      text(c, 'BATIDA!', w / 2, vp.y + 34, 16, '#ff4040', 'center');
      text(c, `Carros restantes: ${Math.max(0, lives - 1)}`, w / 2, vp.y + 62, 8, '#fff', 'center');
    }
  }

  // ---- teto ----
  c.fillStyle = dither(c, '#2a2a2e', '#3a3a40');
  c.fillRect(0, 0, w, ROOF_H);
  c.fillStyle = '#55555c';
  c.fillRect(0, ROOF_H - 2, w, 2);
  const mw = 104, mh = 18, mx = w - mw - 24, my = 2;
  c.fillStyle = '#9a9aa0';
  c.fillRect(mx - 3, my - 1, mw + 6, mh + 2);
  renderMirror(c, r, mx, my, mw, mh);
  c.fillStyle = '#6a6a70';
  c.fillRect(mx + mw / 2 - 2, 0, 4, 2);
  // tempo e progresso
  text(c, stageLabel, 30, 3, 8, '#ffd400', 'left', null);
  text(c, formatTime(totalTime + r.time), mx - 8, 3, 8, '#fff', 'right', null);
  const px = 30, pw = mx - 40 - px, py = 14;
  c.fillStyle = '#111';
  c.fillRect(px, py, pw, 3);
  if (r.rival) {
    const rp = Math.max(0, Math.min(1, (r.rival.z - r.track.startZ) / (r.track.finishZ - r.track.startZ)));
    c.fillStyle = r.rivalCar!.color;
    c.fillRect(px + pw * rp - 2, py - 2, 4, 7);
  }
  c.fillStyle = r.car.color;
  c.fillRect(px + pw * r.progress - 2, py - 2, 4, 7);
  c.fillStyle = '#1a3aa8';
  c.fillRect(px + pw - 1, py - 3, 6, 9);

  // ---- painel ----
  const car = r.car;
  c.fillStyle = car.dash === 'B' ? car.hood : '#c8c8cc';
  c.fillRect(0, DASH_Y, w, 6);
  c.fillStyle = shade(car.dash === 'B' ? car.hood : '#c8c8cc', -0.3);
  c.fillRect(0, DASH_Y + 6, w, 2);
  c.fillStyle = car.dash === 'B' ? dither(c, '#6a6a6e', '#7a7a7e') : dither(c, '#1c1c20', '#2a2a2e');
  c.fillRect(0, DASH_Y + 8, w, h - DASH_Y - 8);
  c.fillStyle = car.dash === 'B' ? '#8a8a8e' : '#3a3a40';
  c.fillRect(0, DASH_Y + 8, w, 2);

  const wcx = Math.round(w * 0.38), wcy = h + 2, R = 96;
  const kmh = Math.round(r.speed * KMH);
  const rpmFrac = 0.12 + Math.min(1, r.rpm) * 0.82;
  gauge(c, wcx - 40, DASH_Y + 46, 34, ['0', '1', '2', '3', '4', '5', '6', '7', '8'], rpmFrac, 0.85, undefined, String(r.gear + 1));
  gauge(c, wcx + 40, DASH_Y + 46, 34, ['0', '', '120', '', '240', '', '360'], kmh / 360, 2, String(kmh));
  smallGauge(c, wcx - 118, DASH_Y + 48, 18, 0.6);
  smallGauge(c, wcx + 118, DASH_Y + 48, 18, 0.35 + r.rpm * 0.2);
  if (car.dash === 'B') {
    shifter(c, wcx + 175, DASH_Y + 54, r.gear);
    radarBox(c, wcx + 205, DASH_Y + 20, 46, 32, r.radar);
  } else {
    radarBox(c, wcx + 158, DASH_Y + 18, 58, 44, r.radar);
  }

  // volante
  wheelAngle = lerp(wheelAngle, r.steer * 0.35, Math.min(1, dt * 10));
  c.save();
  c.translate(wcx, wcy);
  c.rotate(wheelAngle);
  c.strokeStyle = '#101012';
  c.lineWidth = 17;
  c.beginPath();
  c.arc(0, 0, R, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.18)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, R + 4, Math.PI * 1.15, Math.PI * 1.85);
  c.stroke();
  c.fillStyle = '#e8c018';
  c.beginPath();
  c.arc(0, -R, 5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#141416';
  c.lineWidth = 14;
  c.beginPath();
  c.moveTo(-R, -6);
  c.lineTo(-24, -20);
  c.moveTo(R, -6);
  c.lineTo(24, -20);
  c.stroke();
  c.fillStyle = '#141416';
  c.fillRect(-30, -32, 60, 40);
  c.fillStyle = '#e8c018';
  c.beginPath();
  c.arc(0, -14, 8, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // ---- mensagens ----
  if (r.state === 'countdown') {
    const n = Math.ceil(r.timer);
    text(c, n > 3 ? 'PRONTO?' : String(n), w / 2, vp.y + 36, 16, '#ffd400', 'center');
  } else if (r.state === 'drive' && r.time < 1 && r.crashes === 0) {
    text(c, 'VAI!', w / 2, vp.y + 36, 16, '#30e060', 'center');
  }
  if (r.messageT > 0) text(c, r.message, w / 2, vp.y + 14, 8, '#ffd400', 'center');
}
