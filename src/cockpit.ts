import { DASH_Y, KMH, ROOF_H, view } from './config';
import type { Race } from './race';
import { renderMirror, renderRoad, type Viewport } from './render3d';
import { pix, pixWidth } from './pixfont';
import { dither, speckle, text } from './ui';
import { formatTime, lerp, rng, shade } from './util';

// Cabine desenhada em pixels nativos do Super Nintendo (256x224), com as posições
// medidas nas capturas de referência (tools/ref/measure.py). Em telas largas, a área
// de 256 px fica no centro e teto/painel se estendem para os lados.
export const CORE_W = 256;
const HORIZON_Y = 65;

let wheelAngle = 0;
let crackKey = -1;
let cracks: number[][] = [];
const drops: { x: number; y: number; v: number }[] = [];

const coreX = () => Math.floor((view.w - CORE_W) / 2);

export function windshield(): Viewport {
  return { x: 0, y: ROOF_H, w: view.w, h: DASH_Y - ROOF_H, horizon: HORIZON_Y, K: 190 };
}

const disc = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string | CanvasPattern | CanvasGradient) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};

// Mostrador no estilo do original: aro cinza, fundo preto, dígitos de pixel
function gauge(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  labels: string[], frac: number, redFrom: number, extra: { gear?: string; digital?: string; ring?: string } = {},
) {
  disc(c, cx, cy, r + 1, extra.ring ?? '#9a9aa2');
  disc(c, cx, cy, r, '#060606');
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ticks = (labels.length - 1) * 2;
  for (let i = 0; i <= ticks; i++) {
    const f = i / ticks;
    const a = a0 + sweep * f;
    c.fillStyle = f >= redFrom ? '#ff3030' : '#e8e8e8';
    const rr = r - (i % 2 ? 2 : 3);
    c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
    if (i % 2 === 0) c.fillRect(Math.round(cx + Math.cos(a) * (rr + 1)), Math.round(cy + Math.sin(a) * (rr + 1)), 1, 1);
  }
  labels.forEach((l, i) => {
    if (!l) return;
    const f = i / (labels.length - 1);
    const a = a0 + sweep * f;
    pix(c, l, cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9), f >= redFrom ? '#ff4040' : '#f0f0f0');
  });
  if (extra.digital) pix(c, extra.digital, cx, cy + r - 6, '#ff4a2a');
  if (extra.gear) pix(c, extra.gear, cx + r * 0.45, cy + r * 0.38, '#ff2a2a', 2);
  const a = a0 + sweep * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = '#ff3a1a';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
  c.stroke();
  disc(c, cx, cy, 1.5, '#b02a1a');
}

function smallGauge(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number) {
  disc(c, cx, cy, r + 1, '#7a7a80');
  disc(c, cx, cy, r, '#0a0a0a');
  c.fillStyle = '#d8d8d8';
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (0.8 + i * 0.233);
    c.fillRect(Math.round(cx + Math.cos(a) * (r - 2)), Math.round(cy + Math.sin(a) * (r - 2)), 1, 1);
  }
  const a = Math.PI * (0.8 + frac * 1.4);
  c.strokeStyle = '#ff3a1a';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
  c.stroke();
}

function radarLeds(c: CanvasRenderingContext2D, x: number, y: number, w: number, level: number) {
  const blink = level >= 1 && Math.floor(performance.now() / 150) % 2;
  const lw = Math.floor(w / 5);
  for (let i = 0; i < 5; i++) {
    const col = i < 2 ? '#30e060' : i < 4 ? '#ffcc00' : '#ff3030';
    c.fillStyle = level > i / 5 && !blink ? col : shade(col, -0.6);
    c.fillRect(x + i * lw, y, lw - 1, 3);
  }
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
  const { w } = view;
  const vp = windshield();
  renderRoad(c, r, vp);
  weather(c, r, vp, dt);
  if (r.state === 'crash') {
    const t = 2.6 - r.timer;
    drawCracks(c, r, vp, 1);
    if (t > 1.3) {
      c.fillStyle = `rgba(0,0,0,${Math.min(0.75, (t - 1.3) * 0.8)})`;
      c.fillRect(vp.x, vp.y, vp.w, vp.h);
      text(c, 'BATIDA!', w / 2, vp.y + 26, 16, '#ff4040', 'center');
      text(c, `Carros restantes: ${Math.max(0, lives - 1)}`, w / 2, vp.y + 54, 8, '#fff', 'center');
    }
  }
  drawRoof(c, r, stageLabel, totalTime);
  if (r.car.dash === 'A') drawDash959(c, r, dt);
  else drawDashF40(c, r, dt);

  if (r.state === 'countdown') {
    const n = Math.ceil(r.timer);
    text(c, n > 3 ? 'PRONTO?' : String(n), w / 2, vp.y + 28, 16, '#ffd400', 'center');
  } else if (r.state === 'drive' && r.time < 1 && r.crashes === 0) {
    text(c, 'VAI!', w / 2, vp.y + 28, 16, '#30e060', 'center');
  }
  if (r.messageT > 0) text(c, r.message, w / 2, vp.y + 10, 8, '#ffd400', 'center');
  if (r.officer?.phase === 'show' && r.fine) drawFine(c, r, vp);
}

// Teto: tecido escuro, alça do quebra-sol, faixa inferior com os marcadores de
// progresso (como no original) e retrovisor de cantos arredondados.
function drawRoof(c: CanvasRenderingContext2D, r: Race, stageLabel: string, totalTime: number) {
  const { w } = view;
  const ox = coreX();
  c.fillStyle = dither(c, '#2a2a2c', '#343437');
  c.fillRect(0, 0, w, 18);
  c.fillStyle = '#141415';
  c.fillRect(0, 18, w, ROOF_H - 18);
  c.fillStyle = '#4a4a4e';
  c.fillRect(0, 17, w, 1);
  // alça
  c.fillStyle = '#d0d0d4';
  c.beginPath();
  c.roundRect(ox + 10, 7, 27, 11, 3);
  c.fill();
  c.fillStyle = '#16161a';
  c.beginPath();
  c.roundRect(ox + 12, 9, 23, 7, 2);
  c.fill();
  // tempo (o original não mostra; fica discreto na área vazia do teto)
  const clock = `${stageLabel}  ${formatTime(totalTime + r.time)}`;
  pix(c, clock, ox + 46 + pixWidth(clock) / 2, 9, '#8a8a90');
  // marcadores de progresso na faixa inferior
  const px = ox + 44, pw = 126;
  const mark = (z: number, color: string) => {
    const p = Math.max(0, Math.min(1, (z - r.track.startZ) / (r.track.finishZ - r.track.startZ)));
    c.fillStyle = color;
    c.fillRect(Math.round(px + pw * p) - 2, 19, 5, 3);
  };
  c.fillStyle = '#e8e8e8';
  c.fillRect(px + pw + 2, 18, 2, 5);
  if (r.rival) mark(r.rival.z, r.rivalCar!.color);
  mark(r.playerZ, r.car.color);
  // retrovisor
  c.fillStyle = '#5a5a62';
  c.beginPath();
  c.roundRect(ox + 175, 3, 66, 20, 5);
  c.fill();
  c.fillStyle = '#a8a8b0';
  c.beginPath();
  c.roundRect(ox + 176, 4, 64, 18, 4);
  c.fill();
  renderMirror(c, r, ox + 178, 6, 60, 14);
}

// Volante: aro grosso texturizado, marcador amarelo no topo
function rim(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, thick: number, base: [string, string], hi: string) {
  const mid = R - thick / 2;
  c.strokeStyle = dither(c, base[0], base[1]);
  c.lineWidth = thick;
  c.beginPath();
  c.arc(cx, cy, mid, 0, Math.PI * 2);
  c.stroke();
  // brilho no alto do aro: faixa pontilhada suave e filete claro na borda
  c.strokeStyle = dither(c, base[1], shade(base[1], 0.12));
  c.lineWidth = thick * 0.4;
  c.beginPath();
  c.arc(cx, cy, mid + thick * 0.22, Math.PI * 1.08, Math.PI * 1.72);
  c.stroke();
  c.strokeStyle = hi;
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, R - 0.5, Math.PI * 1.12, Math.PI * 1.68);
  c.stroke();
  c.strokeStyle = '#0a0a0c';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, R - thick, 0, Math.PI * 2);
  c.stroke();
  disc(c, cx, cy - R + thick * 0.4, 3, '#f0d020');
}

// Painel do F40 no original: faixa vermelha, painel cinza em degradê pontilhado,
// volante com ponte de raios e centro amarelo, câmbio em H cromado.
function drawDashF40(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  const band = r.car.dash === 'f40' ? '#69140c' : shade(r.car.hood, -0.35);
  c.fillStyle = shade(band, 0.35);
  c.fillRect(0, 120, w, 1);
  c.fillStyle = dither(c, band, shade(band, 0.08));
  c.fillRect(0, 121, w, 9);
  c.fillStyle = shade(band, -0.2);
  c.fillRect(0, 130, w, 2);
  c.fillStyle = '#141210';
  c.fillRect(0, 132, w, 5);
  // painel cinza: degradê claro → escuro em faixas pontilhadas
  const greys = ['#b4b4b4', '#a6a6a6', '#989898', '#8a8a8a', '#7c7c7c', '#6e6e6e', '#606060'];
  for (let i = 0; i < greys.length - 1; i++) {
    const y0 = 137 + i * 13;
    c.fillStyle = dither(c, greys[i], greys[i + 1]);
    c.fillRect(0, y0, w, i === greys.length - 2 ? h - y0 : 13);
  }
  c.fillStyle = speckle(c, 'rgba(0,0,0,0)', [['#d4d4d4', 0.06], ['#7a7a7a', 0.05]], 13);
  c.fillRect(0, 137, w, 16);
  // saídas de ar
  for (const vx of [178, 245]) {
    c.fillStyle = '#5a5a5a';
    c.beginPath();
    c.ellipse(ox + vx, 146, 13, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#7a7a7a';
    c.beginPath();
    c.ellipse(ox + vx, 147, 10, 2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c8c8c8';
    c.fillRect(ox + vx - 9, 142, 18, 1);
  }
  // detector de radar no alto do painel
  c.fillStyle = '#0c0c0c';
  c.fillRect(ox + 200, 131, 32, 7);
  radarLeds(c, ox + 202, 133, 28, r.radar);
  // câmbio em H
  smallGauge(c, ox + 190, 198, 11, 0.5);
  smallGauge(c, ox + 250, 198, 11, 0.62);
  c.fillStyle = '#1e1e1e';
  c.fillRect(ox + 206, 173, 32, 42);
  c.fillStyle = dither(c, '#c4c4c4', '#d2d2d2');
  c.fillRect(ox + 209, 176, 26, 36);
  c.fillStyle = '#e8e8e8';
  c.fillRect(ox + 209, 176, 26, 1);
  c.fillStyle = '#3a3a3a';
  for (const gx of [214, 221, 228]) c.fillRect(ox + gx, 184, 2, 24);
  c.fillRect(ox + 214, 195, 16, 2);
  const pos = [[215, 186], [215, 206], [222, 186], [222, 206], [229, 186]][r.gear];
  const kx = ox + pos[0], ky = pos[1] - 3;
  const kg = c.createRadialGradient(kx - 2, ky - 2, 0.5, kx, ky, 6);
  kg.addColorStop(0, '#ffffff');
  kg.addColorStop(0.45, '#a0a0a8');
  kg.addColorStop(1, '#2a2a30');
  disc(c, kx, ky, 6, kg);

  // volante (gira com a direção)
  wheelAngle = lerp(wheelAngle, r.steer * 0.3, Math.min(1, dt * 10));
  const cx = ox + 85, cy = 198, R = 77;
  c.save();
  c.translate(cx, cy);
  c.rotate(wheelAngle);
  c.translate(-cx, -cy);
  // volante em "D" (topo achatado, laterais retas), medido na referência
  const wx = ox + 10, wy = 121, ww = 150, wh = 140, wr = 60, th = 15;
  c.fillStyle = dither(c, '#4a4a4a', '#585858');
  c.beginPath();
  c.roundRect(wx, wy, ww, wh, wr);
  c.fill();
  c.fillStyle = dither(c, '#2a2a2a', '#343434');
  c.beginPath();
  c.roundRect(wx + 3, wy + 3, ww - 6, wh - 6, wr - 3);
  c.fill();
  c.fillStyle = dither(c, '#343434', '#404040');
  c.beginPath();
  c.roundRect(wx + 3, wy + 2, ww - 6, 8, [wr - 6, wr - 6, 0, 0]);
  c.fill();
  c.strokeStyle = '#8e8e8e';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(wx + wr - 8, wy + 0.5);
  c.lineTo(wx + ww - wr + 8, wy + 0.5);
  c.stroke();
  c.fillStyle = '#080808';
  c.beginPath();
  c.roundRect(wx + th, wy + th, ww - th * 2, wh - th * 2, wr - th);
  c.fill();
  disc(c, cx, wy + 6, 3, '#f0d020');
  const kmh = Math.round(r.speed * KMH);
  gauge(c, cx - 21, 160, 22, ['0', '80', '160', '240', '320'], kmh / 360, 2, { digital: String(kmh), ring: '#3a3a3a' });
  gauge(c, cx + 23, 160, 22, ['0', '20', '40', '60', '80', '100'], 0.1 + Math.min(1, r.rpm) * 0.8, 0.78, { gear: String(r.gear + 1), ring: '#3a3a3a' });
  smallGauge(c, cx - 47, 182, 9, 0.55);
  smallGauge(c, cx + 45, 182, 9, 0.3 + r.rpm * 0.25);
  // ponte dos raios e cubo
  c.strokeStyle = dither(c, '#202020', '#2c2c2c');
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(cx - R + 10, 192);
  c.quadraticCurveTo(cx, 180, cx + R - 10, 192);
  c.stroke();
  c.fillStyle = '#121212';
  c.beginPath();
  c.ellipse(cx, 207, 17, 14, 0, 0, Math.PI * 2);
  c.fill();
  for (const [bx, by] of [[-17, -7], [17, -7], [-17, 9], [17, 9]]) disc(c, cx + bx, 207 + by, 2, '#3c3c3c');
  c.fillStyle = '#b8960e';
  c.beginPath();
  c.ellipse(cx, 208, 10, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f0d018';
  c.beginPath();
  c.ellipse(cx, 207, 9, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff4a0';
  c.fillRect(cx - 5, 202, 4, 2);
  c.restore();
}

// Painel do 959 no original: faixa cinza, painel preto com o alto cintilante,
// volante com almofada inferior, mostradores dentro do aro e radar emoldurado.
function drawDash959(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  c.fillStyle = '#b4b4c4';
  c.fillRect(0, 120, w, 5);
  c.fillStyle = '#9595a4';
  c.fillRect(0, 125, w, 1);
  c.fillStyle = '#7b7b8b';
  c.fillRect(0, 126, w, 1);
  c.fillStyle = dither(c, '#121118', '#18171f');
  c.fillRect(0, 127, w, h - 127);
  c.fillStyle = speckle(c, '#16151c', [['#30303c', 0.22], ['#55556a', 0.08], ['#9a9aae', 0.015]], 14);
  c.beginPath();
  c.moveTo(0, 127);
  c.lineTo(w, 127);
  c.lineTo(w, 138);
  c.quadraticCurveTo(w / 2, 156, 0, 146);
  c.closePath();
  c.fill();
  c.fillStyle = '#0c0b10';
  c.fillRect(0, 179, w, 2);
  c.fillStyle = dither(c, '#1a1a28', '#20202e');
  c.fillRect(0, 181, w, h - 181);
  c.fillStyle = '#3a3a4a';
  c.fillRect(ox + 238, 140, w - ox - 238, 6);

  const kmh = Math.round(r.speed * KMH);
  smallGauge(c, ox + 16, 166, 18, 0.55);
  smallGauge(c, ox + 52, 165, 16, 0.4 + r.rpm * 0.2);
  smallGauge(c, ox + 171, 163, 15, 0.6);
  // radar emoldurado com tela texturizada
  c.fillStyle = '#c8c8d2';
  c.beginPath();
  c.roundRect(ox + 187, 131, 52, 51, 5);
  c.fill();
  c.fillStyle = speckle(c, '#18181e', [['#4a4a56', 0.22], ['#8a8a96', 0.1], ['#d0d0dc', 0.04]], 15);
  c.beginPath();
  c.roundRect(ox + 190, 134, 46, 45, 3);
  c.fill();
  text(c, 'RADAR', ox + 213, 137, 5, '#8a8a96', 'center', null);
  radarLeds(c, ox + 193, 172, 40, r.radar);

  wheelAngle = lerp(wheelAngle, r.steer * 0.3, Math.min(1, dt * 10));
  const cx = ox + 100, cy = 203, R = 78;
  c.save();
  c.translate(cx, cy);
  c.rotate(wheelAngle);
  c.translate(-cx, -cy);
  c.save();
  c.beginPath();
  c.rect(cx - R, 120, R * 2, 61);
  c.clip();
  disc(c, cx, cy, R - 12, '#07070b');
  c.restore();
  gauge(c, cx - 11, 162, 19, ['', '1', '2', '3', '4', '5', '6', '7', '8'], 0.1 + Math.min(1, r.rpm) * 0.8, 0.88, { gear: String(r.gear + 1) });
  gauge(c, cx + 26, 163, 19, ['0', '60', '120', '180', '240', '300', '360'], kmh / 360, 2, { digital: String(kmh) });
  // almofada inferior
  c.fillStyle = speckle(c, '#1c1c26', [['#34344a', 0.25], ['#5a5a70', 0.06]], 16);
  c.beginPath();
  c.roundRect(cx - 43, 205, 91, 24, 6);
  c.fill();
  c.fillStyle = '#0e0e16';
  c.beginPath();
  c.roundRect(cx - 40, 208, 85, 9, 3);
  c.fill();
  rim(c, cx, cy, R, 13, ['#24242e', '#2e2e3a'], '#8a8a9c');
  c.restore();
}

// Papel da multa mostrado pelo policial
function drawFine(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const f = r.fine!;
  const t = r.officer!.t;
  const pw = 150, ph = 86;
  const px = vp.x + vp.w / 2 - pw / 2 - 16;
  const py = vp.y + 5 + (1 - Math.min(1, t * 3)) * 80;
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
  text(c, `VELOCIDADE: ${f.kmh} KM/H`, 10, 36, 5, '#1c1c1c', 'left', null);
  text(c, `LIMITE DA VIA: ${f.limit} KM/H`, 10, 45, 5, '#1c1c1c', 'left', null);
  text(c, 'MULTA', 10, 58, 8, '#1c1c1c', 'left', null);
  text(c, `$ ${f.value}`, pw - 10, 58, 8, '#c01818', 'right', null);
  c.strokeStyle = '#1c2a6a';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i <= 20; i++) c.lineTo(pw - 70 + i * 3, 74 + Math.sin(i * 1.3) * 3);
  c.stroke();
  c.fillStyle = '#c8c0a8';
  c.fillRect(pw - 72, 79, 62, 1);
  // mão do policial
  c.fillStyle = '#e0b088';
  c.fillRect(-10, ph - 34, 18, 22);
  c.fillStyle = '#5a7ac8';
  c.fillRect(-26, ph - 30, 18, 30);
  c.restore();
  if (t > 1.2 && Math.floor(t * 2) % 2) text(c, 'ACELERE PARA SEGUIR', vp.x + vp.w * 0.8, vp.y + vp.h / 2, 5, '#ffd400', 'center');
}
