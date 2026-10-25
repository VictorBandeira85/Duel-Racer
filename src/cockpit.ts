import { DASH_Y, KMH, ROOF_H, view } from './config';
import type { Race } from './race';
import { renderMirror, renderRoad, type Viewport } from './render3d';
import { dither, speckle, text } from './ui';
import { formatTime, lerp, rng, shade } from './util';

let wheelAngle = 0;
let crackKey = -1;
let cracks: number[][] = [];
const drops: { x: number; y: number; v: number }[] = [];

export function windshield(): Viewport {
  const h = DASH_Y - ROOF_H;
  return { x: 0, y: ROOF_H, w: view.w, h, horizon: ROOF_H + Math.round(h * 0.45), K: 215 };
}

function gauge(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  labels: string[], frac: number, redFrom: number, digital?: string, gear?: string,
  style: { face?: string; ink?: string; ring?: string } = {},
) {
  const ink = style.ink ?? '#f0f0f0';
  c.fillStyle = style.ring ?? '#8a8a8a';
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = style.face ?? '#0c0c0c';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ticks = (labels.length - 1) * 2;
  for (let i = 0; i <= ticks; i++) {
    const f = i / ticks;
    const a = a0 + sweep * f;
    const r1 = i % 2 ? r * 0.86 : r * 0.78;
    c.strokeStyle = f >= redFrom ? '#ff3030' : ink;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    c.stroke();
  }
  c.font = `bold ${r > 28 ? 7 : 6}px monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  labels.forEach((l, i) => {
    const f = i / (labels.length - 1);
    const a = a0 + sweep * f;
    c.fillStyle = f >= redFrom ? '#ff4040' : ink;
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

  // ---- teto (tecido pontilhado, alça do quebra-sol, retrovisor) ----
  c.fillStyle = dither(c, '#26262a', '#303036');
  c.fillRect(0, 0, w, ROOF_H);
  c.fillStyle = '#0c0c0e';
  c.fillRect(0, ROOF_H - 2, w, 2);
  c.strokeStyle = '#b8b8bc';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(14, 5);
  c.lineTo(46, 5);
  c.lineTo(42, 15);
  c.lineTo(18, 15);
  c.closePath();
  c.stroke();
  c.strokeStyle = '#5a5a60';
  c.lineWidth = 1;
  c.strokeRect(11.5, 3.5, 38, 14);
  const mw = 108, mh = 17, mx = w - mw - 22, my = 2;
  c.fillStyle = '#5a5a62';
  c.beginPath();
  c.roundRect(mx - 4, my - 2, mw + 8, mh + 4, 5);
  c.fill();
  c.fillStyle = '#a8a8b0';
  c.beginPath();
  c.roundRect(mx - 3, my - 1, mw + 6, mh + 2, 4);
  c.fill();
  renderMirror(c, r, mx, my, mw, mh);
  c.fillStyle = '#3a3a40';
  c.fillRect(mx + mw / 2 - 2, 0, 4, 2);
  // tempo e progresso
  text(c, stageLabel, 58, 3, 8, '#d8c060', 'left', null);
  text(c, formatTime(totalTime + r.time), mx - 10, 3, 8, '#d8d8d8', 'right', null);
  const px = 58, pw = mx - 70 - px, py = 15;
  c.fillStyle = '#121214';
  c.fillRect(px, py, pw, 2);
  if (r.rival) {
    const rp = Math.max(0, Math.min(1, (r.rival.z - r.track.startZ) / (r.track.finishZ - r.track.startZ)));
    c.fillStyle = r.rivalCar!.color;
    c.fillRect(px + pw * rp - 2, py - 2, 4, 5);
  }
  c.fillStyle = r.car.color;
  c.fillRect(px + pw * r.progress - 2, py - 2, 4, 5);
  c.fillStyle = '#e8e8e8';
  c.fillRect(px + pw - 1, py - 3, 3, 7);

  // ---- painel ----
  if (r.car.dash === 'f40') drawDashF40(c, r, dt);
  else drawDashGeneric(c, r, dt);

  // ---- mensagens ----
  if (r.state === 'countdown') {
    const n = Math.ceil(r.timer);
    text(c, n > 3 ? 'PRONTO?' : String(n), w / 2, vp.y + 36, 16, '#ffd400', 'center');
  } else if (r.state === 'drive' && r.time < 1 && r.crashes === 0) {
    text(c, 'VAI!', w / 2, vp.y + 36, 16, '#30e060', 'center');
  }
  if (r.messageT > 0) text(c, r.message, w / 2, vp.y + 14, 8, '#ffd400', 'center');
  if (r.officer?.phase === 'show' && r.fine) drawFine(c, r, vp);
}

// Volante grosso com textura (estilo do jogo original)
function wheel(c: CanvasRenderingContext2D, r: Race, dt: number, cx: number, cy: number, R: number, thick: number, hub: 'pad' | 'yellow') {
  wheelAngle = lerp(wheelAngle, r.steer * 0.35, Math.min(1, dt * 10));
  c.save();
  c.translate(cx, cy);
  c.rotate(wheelAngle);
  // raios
  c.strokeStyle = speckle(c, '#18181c', [['#222228', 0.3]], 5);
  c.lineWidth = hub === 'yellow' ? 12 : 16;
  c.beginPath();
  c.moveTo(-R + 4, -6);
  c.lineTo(-30, -26);
  c.moveTo(R - 4, -6);
  c.lineTo(30, -26);
  c.stroke();
  if (hub === 'pad') {
    c.fillStyle = speckle(c, '#1a1a1e', [['#26262c', 0.3], ['#34343a', 0.05]], 6);
    c.beginPath();
    c.roundRect(-48, -38, 96, 44, 10);
    c.fill();
    c.fillStyle = '#0c0c0e';
    c.beginPath();
    c.roundRect(-40, -30, 80, 18, 6);
    c.fill();
  } else {
    c.fillStyle = '#16161a';
    c.beginPath();
    c.ellipse(0, -26, 26, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8c414';
    c.beginPath();
    c.ellipse(0, -26, 16, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff070';
    c.fillRect(-8, -34, 6, 2);
  }
  // aro
  c.strokeStyle = dither(c, '#141418', '#1e1e24');
  c.lineWidth = thick;
  c.beginPath();
  c.arc(0, 0, R, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = dither(c, '#2a2a32', '#4a4a54');
  c.lineWidth = thick * 0.3;
  c.beginPath();
  c.arc(0, 0, R + thick * 0.18, Math.PI * 1.1, Math.PI * 1.9);
  c.stroke();
  c.fillStyle = '#f0d020';
  c.beginPath();
  c.arc(0, -R, 4.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// Painel escuro com o alto cintilante (estilo do 959 no jogo original)
function drawDashGeneric(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const top = DASH_Y;
  c.fillStyle = '#c4c4c8';
  c.fillRect(0, top, w, 5);
  c.fillStyle = '#86868c';
  c.fillRect(0, top + 5, w, 1);
  c.fillStyle = dither(c, '#101012', '#18181c');
  c.fillRect(0, top + 6, w, h - top - 6);
  // superfície superior com brilho pontilhado
  c.fillStyle = speckle(c, '#18181c', [['#2a2a30', 0.25], ['#46464e', 0.07], ['#7a7a84', 0.015]], 4);
  c.beginPath();
  c.moveTo(0, top + 6);
  c.lineTo(w, top + 6);
  c.lineTo(w, top + 22);
  c.quadraticCurveTo(w * 0.5, top + 36, 0, top + 22);
  c.closePath();
  c.fill();

  const wcx = Math.round(w * 0.38), wcy = h + 2, R = 100;
  const kmh = Math.round(r.speed * KMH);
  const rpmFrac = 0.1 + Math.min(1, r.rpm) * 0.8;
  // nicho dos instrumentos
  c.fillStyle = '#060608';
  c.beginPath();
  c.roundRect(wcx - 76, top + 24, 152, 74, 18);
  c.fill();
  smallGauge(c, wcx - 150, top + 54, 21, 0.55);
  smallGauge(c, wcx - 104, top + 52, 20, 0.4 + r.rpm * 0.2);
  smallGauge(c, wcx + 106, top + 52, 20, 0.6);
  gauge(c, wcx - 33, top + 52, 28, ['0', '1', '2', '3', '4', '5', '6', '7', '8'], rpmFrac, 0.85, undefined, String(r.gear + 1));
  gauge(c, wcx + 35, top + 52, 28, ['0', '60', '120', '180', '240', '300', '360'], kmh / 360, 2, String(kmh));

  // detector de radar em moldura cinza
  const bx = Math.min(w - 64, wcx + 150), by = top + 16;
  c.fillStyle = '#9a9aa2';
  c.beginPath();
  c.roundRect(bx - 3, by - 3, 60, 52, 6);
  c.fill();
  c.fillStyle = speckle(c, '#18181c', [['#3a3a42', 0.2], ['#5a5a64', 0.05]], 9);
  c.beginPath();
  c.roundRect(bx, by, 54, 46, 4);
  c.fill();
  text(c, 'RADAR', bx + 27, by + 4, 5, '#9a9aa2', 'center', null);
  radarLeds(c, bx + 5, by + 32, 44, r.radar);

  wheel(c, r, dt, wcx, wcy, R, 15, 'pad');
}

function radarLeds(c: CanvasRenderingContext2D, x: number, y: number, w: number, level: number) {
  const blink = level >= 1 && Math.floor(performance.now() / 150) % 2;
  const lw = w / 5;
  for (let i = 0; i < 5; i++) {
    const col = i < 2 ? '#30e060' : i < 4 ? '#ffcc00' : '#ff3030';
    c.fillStyle = level > i / 5 && !blink ? col : shade(col, -0.6);
    c.fillRect(x + i * lw, y, lw - 2, 6);
  }
}

// Painel cinza pontilhado com faixa vermelha (estilo do F40 no jogo original)
function drawDashF40(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const top = DASH_Y;
  c.fillStyle = '#d82020';
  c.fillRect(0, top, w, 2);
  c.fillStyle = '#9a1212';
  c.fillRect(0, top + 2, w, 7);
  c.fillStyle = '#5a0a0a';
  c.fillRect(0, top + 9, w, 1);
  c.fillStyle = '#0c0c0e';
  c.fillRect(0, top + 10, w, 2);
  c.fillStyle = dither(c, '#88888c', '#9a9a9e');
  c.fillRect(0, top + 12, w, h - top - 12);
  // sombra suave nas bordas do painel
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.fillRect(0, top + 12, w * 0.08, h - top - 12);
  c.fillRect(0, h - 18, w, 18);

  const wcx = Math.round(w * 0.36), wcy = h + 4, R = 102;
  // saídas de ar ovais
  for (const vx of [w * 0.68, w * 0.9]) {
    c.strokeStyle = '#5c5c62';
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(vx, top + 30, 19, 5, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#9c9ca2';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(vx, top + 28, 19, 5, 0, Math.PI, Math.PI * 2);
    c.stroke();
  }

  // nicho dos instrumentos
  c.fillStyle = '#0a0a0c';
  c.beginPath();
  c.roundRect(wcx - 74, top + 22, 148, 80, 20);
  c.fill();
  const kmh = Math.round(r.speed * KMH);
  const rpmFrac = 0.1 + Math.min(1, r.rpm) * 0.8;
  gauge(c, wcx - 31, top + 52, 28, ['0', '80', '160', '240', '320'], kmh / 360, 2, String(kmh));
  gauge(c, wcx + 31, top + 52, 28, ['0', '20', '40', '60', '80', '100'], rpmFrac, 0.78, undefined, String(r.gear + 1));
  smallGauge(c, wcx - 56, top + 84, 11, 0.55);
  smallGauge(c, wcx + 56, top + 84, 11, 0.3 + r.rpm * 0.25);

  // câmbio em H cromado entre dois relógios
  const sx = Math.round(w * 0.72), sy = h - 30;
  smallGauge(c, sx - 34, sy + 10, 14, 0.5);
  smallGauge(c, sx + 34, sy + 10, 14, 0.62);
  c.fillStyle = '#2a2a2e';
  c.fillRect(sx - 16, sy - 22, 32, 52);
  c.fillStyle = '#e4e4e8';
  c.fillRect(sx - 13, sy - 19, 26, 46);
  c.fillStyle = '#1a1a1e';
  for (const gx of [-7, 0, 7]) c.fillRect(sx + gx - 1, sy - 12, 3, 30);
  c.fillRect(sx - 7, sy + 2, 15, 3);
  const pos = [[-7, -12], [-7, 16], [0, -12], [0, 16], [7, -12]][r.gear];
  const kg = c.createRadialGradient(sx + pos[0] - 2, sy + pos[1] - 3, 1, sx + pos[0], sy + pos[1], 8);
  kg.addColorStop(0, '#ffffff');
  kg.addColorStop(0.4, '#a8a8b0');
  kg.addColorStop(1, '#3a3a40');
  c.fillStyle = kg;
  c.beginPath();
  c.arc(sx + pos[0], sy + pos[1] - 2, 8, 0, Math.PI * 2);
  c.fill();

  // detector de radar no alto do painel
  const rx = Math.round(w * 0.8), ry = top - 1;
  c.fillStyle = '#0e0e10';
  c.fillRect(rx, ry, 44, 11);
  radarLeds(c, rx + 3, ry + 3, 40, r.radar);

  wheel(c, r, dt, wcx, wcy, R, 18, 'yellow');
}

// Papel da multa mostrado pelo policial
function drawFine(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const f = r.fine!;
  const t = r.officer!.t;
  const pw = 168, ph = 104;
  const px = vp.x + vp.w / 2 - pw / 2 - 20;
  const py = vp.y + 8 + (1 - Math.min(1, t * 3)) * 80;
  c.save();
  c.translate(px + pw / 2, py + ph / 2);
  c.rotate(-0.04);
  c.translate(-pw / 2, -ph / 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(3, 3, pw, ph);
  c.fillStyle = '#f6f2e6';
  c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#1c2a6a';
  c.fillRect(0, 0, pw, 14);
  text(c, 'POLÍCIA RODOVIÁRIA', pw / 2, 4, 5, '#fff', 'center', null);
  text(c, 'AUTO DE INFRAÇÃO', pw / 2, 20, 8, '#1c1c1c', 'center', null);
  c.fillStyle = '#c8c0a8';
  c.fillRect(8, 31, pw - 16, 1);
  text(c, `VELOCIDADE: ${f.kmh} KM/H`, 10, 38, 5, '#1c1c1c', 'left', null);
  text(c, `LIMITE DA VIA: ${f.limit} KM/H`, 10, 48, 5, '#1c1c1c', 'left', null);
  text(c, 'MULTA', 10, 64, 8, '#1c1c1c', 'left', null);
  text(c, `$ ${f.value}`, pw - 10, 64, 8, '#c01818', 'right', null);
  c.strokeStyle = '#1c2a6a';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i <= 20; i++) c.lineTo(pw - 70 + i * 3, 90 + Math.sin(i * 1.3) * 3);
  c.stroke();
  c.fillStyle = '#c8c0a8';
  c.fillRect(pw - 72, 95, 62, 1);
  // mão do policial
  c.fillStyle = '#e0b088';
  c.fillRect(-10, ph - 34, 18, 22);
  c.fillStyle = '#5a7ac8';
  c.fillRect(-26, ph - 30, 18, 30);
  c.restore();
  if (t > 1.2 && Math.floor(t * 2) % 2) text(c, 'ACELERE PARA SEGUIR', vp.x + vp.w * 0.8, vp.y + vp.h / 2, 5, '#ffd400', 'center');
}
