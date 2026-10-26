import { DASH_Y, KMH, ROOF_H, view } from './config';
import type { Race } from './race';
import { renderMirror, renderRoad, type Viewport } from './render3d';
import { pix, pixWidth } from './pixfont';
import { dither, speckle, text } from './ui';
import { formatTime, lerp, rng, shade } from './util';
import { F40_WHEEL } from './svg/f40';
import { svgSprite } from './svgsprites';
// cabines em pixel art (tools/ref/import_cockpit.py)
import dashF40Png from './assets/cockpit/f40-dash.png';
import wheelF40Png from './assets/cockpit/f40-wheel.png';
import dash959Png from './assets/cockpit/959-dash.png';
import wheel959Png from './assets/cockpit/959-wheel.png';

interface CockpitArt {
  dash: string;
  wheel: string;
  pivot: [number, number]; // centro do aro (pixels nativos, a partir do topo da arte)
  tach: [number, number, number]; // x, y, raio
  speed: [number, number, number];
  speedMax: number;
  needle: string;
  hub: string;
}

// a arte cobre da linha 100 da tela até o fim (124 linhas); o topo transparente mostra a estrada
const ART_TOP = 100;
const DASH_PAD = 102; // colunas extras de cada lado do painel (telas largas), ver import_cockpit.py
const DASH_W = 256 + 2 * DASH_PAD;
const COCKPIT_ART: Record<string, CockpitArt> = {
  f40: { dash: dashF40Png, wheel: wheelF40Png, pivot: [127.4, 80], tach: [109, 42.9, 17.5], speed: [149, 42.9, 17.5], speedMax: 360, needle: '#ff2a1a', hub: '#ff2a1a' },
  '959': { dash: dash959Png, wheel: wheel959Png, pivot: [127.8, 104], tach: [127.4, 61.1, 23.5], speed: [177.8, 66.6, 20.2], speedMax: 300, needle: '#ff6a1a', hub: '#1a1a1a' },
};

export const COCKPIT_IMAGES = Object.values(COCKPIT_ART).flatMap((a) => [a.dash, a.wheel]);

// Cabine a partir da arte: painel, ponteiros dinâmicos, radar e volante girando.
function drawCockpitArt(c: CanvasRenderingContext2D, r: Race, dt: number, art: CockpitArt): boolean {
  const { w } = view;
  const ox = coreX();
  const dash = svgSprite(art.dash, DASH_W, 124);
  const wheelImg = svgSprite(art.wheel, CORE_W, 124);
  if (!dash || !wheelImg) return false;
  // o painel tem DASH_PAD colunas a mais de cada lado; só além disso a borda é esticada
  const dx = ox - DASH_PAD;
  if (dx > 0) {
    c.drawImage(dash, 0, 0, 2, 124, 0, ART_TOP, dx, 124);
    c.drawImage(dash, DASH_W - 2, 0, 2, 124, dx + DASH_W, ART_TOP, w - dx - DASH_W, 124);
  }
  c.drawImage(dash, dx, ART_TOP);
  const needle = (g: [number, number, number], frac: number) => {
    const [gx, gy, gr] = g;
    const cx = ox + gx, cy = ART_TOP + gy;
    const a = Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1.02, frac));
    c.strokeStyle = art.needle;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * (gr - 4), cy + Math.sin(a) * (gr - 4) * (8 / 7));
    c.stroke();
    disc(c, cx, cy, 2, art.hub);
  };
  needle(art.tach, 0.06 + Math.min(1, r.rpm) * 0.82);
  needle(art.speed, (r.speed * KMH) / art.speedMax);
  rect(c, ox + 206, ART_TOP + 22, 30, 6, '#0c0c0e');
  radarLeds(c, ox + 208, ART_TOP + 23, 26, r.radar);
  const px = ox + art.pivot[0], py = ART_TOP + art.pivot[1];
  withRotation(c, px, py, steerAngle(r, dt), () => c.drawImage(wheelImg, ox, ART_TOP));
  return true;
}

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
  const art = COCKPIT_ART[r.car.dash];
  // nas cabines desenhadas, os vidros laterais vão abaixo do painel: a estrada desce até o fim
  renderRoad(c, r, art ? { ...vp, h: view.h - vp.y } : vp);
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
  const dash = r.car.dash;
  if (art && drawCockpitArt(c, r, dt, art)) {
    // cabine desenhada a partir da arte
  } else if (dash === 'f40') drawDashF40(c, r, dt);
  else if (dash === '959') drawDash959(c, r, dt);
  else if (dash === 'A') drawDashTD2Black(c, r, dt);
  else drawDashTD2Grey(c, r, dt);

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

// ---------- utilidades de desenho do interior ----------
const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasPattern) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// Sombra suave (projetada pelo volante, sob a capota dos instrumentos etc.)
function shadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.translate(-x, -y);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// Escurece a parte de baixo do painel (luz vem do para-brisa)
function vignette(c: CanvasRenderingContext2D, y0: number) {
  const { w, h } = view;
  const g = c.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g;
  c.fillRect(0, y0, w, h - y0);
}

// Reflexo no vidro do mostrador
function glint(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, r - 2, Math.PI * 1.1, Math.PI * 1.45);
  c.stroke();
}

// Mostrador realista: aro cromado, mostrador colorido, ponteiro, reflexo
function dial(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number, labels: string[], frac: number,
  o: { face: string; ink: string; needle: string; red?: number; gear?: string; digital?: string; bezel?: string },
) {
  disc(c, cx, cy, r + 2, '#0a0a0c');
  disc(c, cx, cy, r + 1, o.bezel ?? '#8c8e94');
  disc(c, cx, cy, r, o.face);
  shadow(c, cx, cy - r * 0.6, r, r * 0.5, 0.35); // sombra da borda superior
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ticks = (labels.length - 1) * 2;
  for (let i = 0; i <= ticks; i++) {
    const f = i / ticks;
    const a = a0 + sweep * f;
    c.fillStyle = o.red !== undefined && f >= o.red ? '#ff3020' : o.ink;
    const rr = r - 2;
    c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
  }
  labels.forEach((l, i) => {
    if (!l) return;
    const f = i / (labels.length - 1);
    const a = a0 + sweep * f;
    pix(c, l, cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7), o.red !== undefined && f >= o.red ? '#ff3020' : o.ink);
  });
  if (o.digital) pix(c, o.digital, cx, cy + r - 5, '#ff5a2a');
  if (o.gear) pix(c, o.gear, cx + r * 0.42, cy + r * 0.4, '#ff2a1a', 2);
  const a = a0 + sweep * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = o.needle;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
  c.stroke();
  disc(c, cx, cy, 1.5, '#1a1a1a');
  glint(c, cx, cy, r);
}

// Raio de volante afunilado (do cubo ao aro)
function spoke(c: CanvasRenderingContext2D, cx: number, cy: number, ang: number, r0: number, r1: number, w0: number, w1: number, fill: string, edge: string) {
  const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
  const pts = [
    cx + ca * r0 + px * w0, cy + sa * r0 + py * w0,
    cx + ca * r1 + px * w1, cy + sa * r1 + py * w1,
    cx + ca * r1 - px * w1, cy + sa * r1 - py * w1,
    cx + ca * r0 - px * w0, cy + sa * r0 - py * w0,
  ];
  c.fillStyle = fill;
  c.beginPath();
  for (let i = 0; i < 8; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  c.lineTo(pts[2], pts[3]);
  c.stroke();
}

// Aro redondo de couro com reflexo da luz do para-brisa
function leatherRim(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, th: number) {
  const mid = R - th / 2;
  c.strokeStyle = dither(c, '#141416', '#1c1c20');
  c.lineWidth = th;
  c.beginPath();
  c.arc(cx, cy, mid, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(160,165,180,0.55)';
  c.lineWidth = Math.max(1, th * 0.28);
  c.beginPath();
  c.arc(cx, cy, mid + th * 0.18, Math.PI * 1.08, Math.PI * 1.6);
  c.stroke();
  c.strokeStyle = 'rgba(230,232,240,0.7)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, mid + th * 0.22, Math.PI * 1.22, Math.PI * 1.4);
  c.stroke();
  c.strokeStyle = 'rgba(120,125,140,0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, mid - th * 0.3, Math.PI * 0.15, Math.PI * 0.55);
  c.stroke();
}

function steerAngle(r: Race, dt: number) {
  wheelAngle = lerp(wheelAngle, r.steer * 0.3, Math.min(1, dt * 10));
  return wheelAngle;
}

function withRotation(c: CanvasRenderingContext2D, cx: number, cy: number, ang: number, draw: () => void) {
  c.save();
  c.translate(cx, cy);
  c.rotate(ang);
  c.translate(-cx, -cy);
  draw();
  c.restore();
}

// ---------- F40 (fotos do carro real) ----------
// Painel de feltro azul-acinzentado, capota dos instrumentos à esquerda,
// velocímetro claro e conta-giros avermelhado, volante Momo de 3 raios,
// saída de ar redonda, 3 relógios no centro, chave vermelha, porta-luvas,
// câmbio de bola preta e assoalho de kevlar.
function drawDashF40(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  // bico vermelho visto pelo para-brisa
  rect(c, 0, 120, w, 1, '#e04030');
  rect(c, 0, 121, w, 3, dither(c, '#b01818', '#c02020'));
  rect(c, 0, 124, w, 1, '#600808');
  // feltro: face superior iluminada → frente mais escura
  const felt = [['#5e6270', '#666a78'], ['#525664', '#5a5e6c'], ['#464a58', '#4e5260'], ['#3c404c', '#424654']];
  felt.forEach(([a, b], i) => rect(c, 0, 125 + i * 4, w, 4, dither(c, a, b)));
  rect(c, 0, 141, w, h - 141, speckle(c, '#3a3d48', [['#43465a', 0.3], ['#32353f', 0.25]], 21));
  rect(c, 0, 140, w, 1, '#2a2c34');
  // assoalho de kevlar e túnel (canto inferior direito)
  rect(c, ox + 170, 196, w - ox - 170, h - 196, dither(c, '#2a2a22', '#36362c'));
  for (let x = ox + 170; x < w; x += 4) for (let y = 196; y < h; y += 4) rect(c, x + ((y / 4) % 2) * 2, y, 2, 2, '#40402f');
  rect(c, ox + 170, 194, w - ox - 170, 2, '#1c1d22');
  shadow(c, ox + 210, 196, 60, 10, 0.6);
  // porta-luvas
  c.fillStyle = dither(c, '#454956', '#4c505e');
  c.beginPath();
  c.roundRect(ox + 194, 144, 58, 34, 3);
  c.fill();
  rect(c, ox + 194, 144, 58, 1, '#646878');
  rect(c, ox + 194, 177, 58, 1, '#24262c');
  for (const [sx, sy] of [[197, 147], [248, 147], [197, 174], [248, 174]]) rect(c, ox + sx, sy, 1, 1, '#9a9ca6');
  // saída de ar redonda no alto do painel
  disc(c, ox + 168, 130, 7, '#24262e');
  disc(c, ox + 168, 130, 6, '#101116');
  for (const dy of [-3, -1, 1, 3]) rect(c, ox + 163, 130 + dy, 10, 1, '#3e4250');
  rect(c, ox + 162, 125, 12, 1, '#7a7e8e');
  // três relógios pequenos no centro
  [0.5, 0.62, 0.4].forEach((f, i) => dial(c, ox + 148 + i * 15, 156, 6, ['', '', ''], f, { face: '#16161a', ink: '#e8e8e8', needle: '#ff4020', bezel: '#a8aab2' }));
  // chave de ignição vermelha
  disc(c, ox + 140, 178, 3, '#8a8c94');
  disc(c, ox + 140, 178, 2, '#3a3a40');
  c.strokeStyle = '#e02818';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(ox + 141, 178);
  c.lineTo(ox + 150, 182);
  c.stroke();
  rect(c, ox + 146, 180, 4, 1, '#ff7a60');
  // alavanca de luzes à esquerda
  rect(c, ox + 2, 184, 18, 6, '#1a1b20');
  rect(c, ox + 4, 186, 3, 2, '#c8c8c8');
  rect(c, ox + 10, 186, 7, 2, '#5a5c64');
  // capota dos instrumentos (feltro) com nicho escuro
  c.fillStyle = dither(c, '#4a4e5c', '#525664');
  c.beginPath();
  c.roundRect(ox + 22, 126, 108, 50, [14, 14, 4, 4]);
  c.fill();
  rect(c, ox + 30, 126, 92, 1, '#6e7282');
  c.fillStyle = '#0c0d10';
  c.beginPath();
  c.roundRect(ox + 28, 134, 96, 40, [10, 10, 3, 3]);
  c.fill();
  shadow(c, ox + 76, 136, 50, 8, 0.8);
  // instrumentos
  const kmh = Math.round(r.speed * KMH);
  dial(c, ox + 54, 154, 15, ['', '', '120', '', '240', '', ''], kmh / 360, { face: '#dcd6c2', ink: '#1a1a1a', needle: '#e03010', digital: String(kmh) });
  dial(c, ox + 94, 152, 15, ['0', '', '40', '', '80', '', ''], 0.08 + Math.min(1, r.rpm) * 0.8, { face: '#a8301c', ink: '#f4dcb4', needle: '#f0f0f0', red: 0.75, gear: String(r.gear + 1) });
  dial(c, ox + 36, 168, 7, ['', '', ''], 0.55, { face: '#101012', ink: '#e8e8e8', needle: '#ff4020' });
  dial(c, ox + 116, 166, 6, ['', '', ''], 0.3 + r.rpm * 0.3, { face: '#101012', ink: '#e8e8e8', needle: '#ff4020' });
  // detector de radar preso no painel
  rect(c, ox + 200, 132, 30, 7, '#0c0c0e');
  radarLeds(c, ox + 202, 134, 26, r.radar);
  // câmbio: haste cromada e bola preta
  c.strokeStyle = '#c8ccd4';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(ox + 214, h);
  c.lineTo(ox + 210, 194);
  c.stroke();
  rect(c, ox + 211, 196, 1, 28, '#ffffff');
  disc(c, ox + 210, 191, 6, '#0e0e10');
  disc(c, ox + 208, 189, 2, '#6a6a72');
  rect(c, ox + 207, 188, 1, 1, '#ffffff');
  // volante Momo: sombra no painel, 3 raios, cubo com emblema amarelo
  const cx = ox + 78, cy = 200, R = 60;
  shadow(c, cx + 8, cy - 6, R, R * 0.8, 0.35);
  vignette(c, 176);
  const wheelSpr = svgSprite(F40_WHEEL, R * 2, R * 2);
  if (wheelSpr) {
    withRotation(c, cx, cy, steerAngle(r, dt), () => c.drawImage(wheelSpr, cx - R, cy - R, R * 2, R * 2));
    return;
  }
  withRotation(c, cx, cy, steerAngle(r, dt), () => {
    for (const ang of [Math.PI * 1.03, -Math.PI * 0.04, Math.PI * 0.46]) spoke(c, cx, cy, ang, 10, R - 4, 5, 3.5, '#4a4b52', '#8a8c96');
    disc(c, cx, cy, 13, '#121216');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.5;
      rect(c, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 1, 1, '#7a7c86');
    }
    disc(c, cx, cy, 8, '#8a6c08');
    disc(c, cx, cy, 7, '#f0c814');
    rect(c, cx - 1, cy - 3, 2, 6, '#1a1a1a');
    rect(c, cx - 4, cy - 5, 3, 1, '#fff6a8');
    leatherRim(c, cx, cy, R, 7);
  });
}

// ---------- 959 (fotos do carro real) ----------
// Painel de couro escuro, capota sobre 5 mostradores redondos (conta-giros no
// centro), ponteiros laranja, volante de aro grosso com almofada retangular,
// difusor horizontal, botões, rádio e coifa do câmbio.
// Painel do 959 a partir da foto convertida em pixel art: fundo (sem volante e sem
// ponteiros), ponteiros laranja dinâmicos nos mostradores da foto e volante da foto.
const P959 = {
  wheel: { sx: 60.5, sy: 69.2, x: 69.1, y: 52.6 }, // centro no sprite e no painel
  tach: [82, 25.4, 12.7], speed: [112.1, 27.2, 11.9], // x, y, raio (pixels nativos)
};

function photoNeedle(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number) {
  const a = Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = '#ff7a1a';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2) * (8 / 7));
  c.stroke();
  disc(c, cx, cy, 1.5, '#202020');
}

function drawDash959Photo(c: CanvasRenderingContext2D, r: Race, dt: number): boolean {
  const { w } = view;
  const ox = coreX();
  const dash = svgSprite(dash959Png, CORE_W, 104);
  const wheelImg = svgSprite(wheel959Png, 121, 138);
  if (!dash || !wheelImg) return false;
  // laterais em telas largas: estica as bordas do painel
  if (ox > 0) {
    c.drawImage(dash, 0, 0, 12, 104, 0, 120, ox, 104);
    c.drawImage(dash, CORE_W - 12, 0, 12, 104, ox + CORE_W, 120, w - ox - CORE_W, 104);
  }
  c.drawImage(dash, ox, 120);
  const kmh = r.speed * KMH;
  const [tx, ty, tr] = P959.tach, [vx, vy, vr] = P959.speed;
  photoNeedle(c, ox + tx, 120 + ty, tr, 0.08 + Math.min(1, r.rpm) * 0.8);
  photoNeedle(c, ox + vx, 120 + vy, vr, kmh / 340);
  pix(c, String(r.gear + 1), ox + tx + 5, 120 + ty + 8, '#ff2a1a');
  rect(c, ox + 160, 121, 30, 6, '#0c0c0e');
  radarLeds(c, ox + 162, 122, 26, r.radar);
  const cx = ox + P959.wheel.x, cy = 120 + P959.wheel.y;
  withRotation(c, cx, cy, steerAngle(r, dt), () => c.drawImage(wheelImg, Math.round(cx - P959.wheel.sx), Math.round(cy - P959.wheel.sy)));
  return true;
}

function drawDash959(c: CanvasRenderingContext2D, r: Race, dt: number) {
  if (drawDash959Photo(c, r, dt)) return;
  const { w, h } = view;
  const ox = coreX();
  // capô prateado
  rect(c, 0, 120, w, 1, '#e8ecf0');
  rect(c, 0, 121, w, 2, '#a8acb4');
  // face superior do painel refletindo o céu → couro escuro
  const top = [['#6a6e78', '#727680'], ['#5a5e68', '#62666e'], ['#4a4d56', '#52555e'], ['#3c3f46', '#43464e']];
  top.forEach(([a, b], i) => rect(c, 0, 123 + i * 3, w, 3, dither(c, a, b)));
  rect(c, 0, 135, w, h - 135, speckle(c, '#2e3036', [['#34363d', 0.3], ['#26282d', 0.25]], 22));
  rect(c, 0, 135, w, 1, '#1a1b1f');
  // console central: difusor, botões e rádio
  rect(c, ox + 172, 138, 56, 16, '#16171b');
  for (let i = 0; i < 4; i++) rect(c, ox + 174, 140 + i * 3, 52, 1, '#5a5d66');
  rect(c, ox + 198, 138, 2, 16, '#26272c');
  rect(c, ox + 172, 138, 56, 1, '#7a7d86');
  for (let i = 0; i < 5; i++) {
    disc(c, ox + 176 + i * 11, 162, 3, '#202126');
    disc(c, ox + 176 + i * 11, 162, 2, i === 3 ? '#40c050' : '#4a4c54');
  }
  rect(c, ox + 172, 169, 52, 14, '#141518');
  rect(c, ox + 172, 169, 52, 1, '#8a8d96');
  rect(c, ox + 176, 172, 18, 4, '#3a2a10');
  rect(c, ox + 177, 173, 10, 2, '#e09030');
  for (let i = 0; i < 5; i++) rect(c, ox + 198 + i * 5, 173, 3, 6, '#3c3e46');
  rect(c, ox + 228, 135, w - ox - 228, 48, dither(c, '#34363c', '#3a3c42'));
  // coifa do câmbio
  c.fillStyle = '#1a1b1e';
  c.beginPath();
  c.moveTo(ox + 196, h);
  c.lineTo(ox + 202, 202);
  c.lineTo(ox + 218, 202);
  c.lineTo(ox + 224, h);
  c.closePath();
  c.fill();
  for (const fy of [208, 214, 220]) rect(c, ox + 200, fy, 22, 1, '#2c2d32');
  disc(c, ox + 210, 199, 5, '#101012');
  rect(c, ox + 208, 197, 2, 1, '#8a8a92');
  // capota sobre os mostradores
  c.fillStyle = dither(c, '#2a2c32', '#30323a');
  c.beginPath();
  c.roundRect(ox + 8, 128, 154, 42, [18, 18, 4, 4]);
  c.fill();
  rect(c, ox + 18, 128, 134, 1, '#5e616c');
  c.fillStyle = '#0b0b0e';
  c.beginPath();
  c.roundRect(ox + 12, 136, 146, 32, [12, 12, 3, 3]);
  c.fill();
  shadow(c, ox + 85, 138, 76, 7, 0.85);
  // 5 mostradores (estilo 911): conta-giros grande no centro
  const kmh = Math.round(r.speed * KMH);
  const o = { face: '#0e0e10', ink: '#ececec', needle: '#ff7a1a', bezel: '#5a5c62' };
  dial(c, ox + 28, 154, 11, ['', '', '', ''], 0.5, o);
  dial(c, ox + 55, 153, 12, ['', '', '', ''], 0.35 + r.rpm * 0.2, o);
  dial(c, ox + 85, 152, 15, ['', '', '2', '', '4', '', '6', '', '8'], 0.08 + Math.min(1, r.rpm) * 0.8, { ...o, red: 0.85, gear: String(r.gear + 1) });
  dial(c, ox + 116, 153, 13, ['', '', '100', '', '200', '', '300', ''], kmh / 340, { ...o, digital: String(kmh) });
  dial(c, ox + 144, 154, 11, ['', '', '', ''], 0.6, o);
  // detector de radar sobre o painel
  rect(c, ox + 172, 128, 30, 7, '#0c0c0e');
  radarLeds(c, ox + 174, 130, 26, r.radar);
  // volante: aro grosso, almofada retangular e braços laterais
  const cx = ox + 85, cy = 202, R = 66;
  shadow(c, cx + 8, cy - 8, R, R * 0.8, 0.4);
  vignette(c, 172);
  withRotation(c, cx, cy, steerAngle(r, dt), () => {
    // braços que ligam a almofada ao aro
    c.fillStyle = dither(c, '#202126', '#26272c');
    c.fillRect(cx - R + 4, cy - 14, 20, 14);
    c.fillRect(cx + R - 24, cy - 14, 20, 14);
    rect(c, cx - R + 4, cy - 14, 20, 1, '#5a5c66');
    rect(c, cx + R - 24, cy - 14, 20, 1, '#5a5c66');
    rect(c, cx + R - 22, cy - 11, 6, 4, '#0c0c0e');
    rect(c, cx + R - 21, cy - 10, 2, 1, '#d8d8d8');
    // almofada central
    c.fillStyle = '#16171a';
    c.beginPath();
    c.roundRect(cx - 42, cy - 22, 84, 30, 5);
    c.fill();
    c.fillStyle = dither(c, '#50535a', '#585b62');
    c.beginPath();
    c.roundRect(cx - 40, cy - 21, 80, 27, 4);
    c.fill();
    rect(c, cx - 36, cy - 21, 72, 1, '#8a8d96');
    rect(c, cx - 38, cy + 4, 76, 1, '#2a2b30');
    for (let i = 0; i < 7; i++) rect(c, cx - 21 + i * 6, cy - 9, 4, 3, '#5e6168');
    leatherRim(c, cx, cy, R, 10);
  });
}

// ---------- outros carros: painéis no estilo do jogo original ----------
// Preto com o alto cintilante (carros 'A') e cinza com faixa colorida (carros 'B').
function drawDashTD2Black(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  rect(c, 0, 120, w, 5, '#b4b4c4');
  rect(c, 0, 125, w, 1, '#9595a4');
  rect(c, 0, 126, w, 1, '#7b7b8b');
  rect(c, 0, 127, w, h - 127, dither(c, '#121118', '#18171f'));
  c.fillStyle = speckle(c, '#16151c', [['#30303c', 0.22], ['#55556a', 0.08], ['#9a9aae', 0.015]], 14);
  c.beginPath();
  c.moveTo(0, 127);
  c.lineTo(w, 127);
  c.lineTo(w, 138);
  c.quadraticCurveTo(w / 2, 156, 0, 146);
  c.closePath();
  c.fill();
  rect(c, 0, 179, w, 2, '#0c0b10');
  rect(c, 0, 181, w, h - 181, dither(c, '#1a1a28', '#20202e'));
  const kmh = Math.round(r.speed * KMH);
  smallGauge(c, ox + 16, 166, 18, 0.55);
  smallGauge(c, ox + 52, 165, 16, 0.4 + r.rpm * 0.2);
  smallGauge(c, ox + 171, 163, 15, 0.6);
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
  const cx = ox + 100, cy = 203, R = 78;
  // nicho preto e mostradores fixos (só o volante gira)
  c.save();
  c.beginPath();
  c.rect(cx - R, 120, R * 2, 61);
  c.clip();
  disc(c, cx, cy, R - 12, '#07070b');
  c.restore();
  gauge(c, cx - 11, 162, 19, ['', '1', '2', '3', '4', '5', '6', '7', '8'], 0.1 + Math.min(1, r.rpm) * 0.8, 0.88, { gear: String(r.gear + 1) });
  gauge(c, cx + 26, 163, 19, ['0', '60', '120', '180', '240', '300', '360'], kmh / 360, 2, { digital: String(kmh) });
  withRotation(c, cx, cy, steerAngle(r, dt), () => {
    c.fillStyle = speckle(c, '#1c1c26', [['#34344a', 0.25], ['#5a5a70', 0.06]], 16);
    c.beginPath();
    c.roundRect(cx - 43, 205, 91, 24, 6);
    c.fill();
    rect(c, cx - 40, 208, 85, 9, '#0e0e16');
    rim(c, cx, cy, R, 13, ['#24242e', '#2e2e3a'], '#8a8a9c');
  });
}

function drawDashTD2Grey(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  const band = shade(r.car.hood, -0.35);
  rect(c, 0, 120, w, 1, shade(band, 0.35));
  rect(c, 0, 121, w, 9, dither(c, band, shade(band, 0.08)));
  rect(c, 0, 130, w, 2, shade(band, -0.2));
  rect(c, 0, 132, w, 5, '#141210');
  const greys = ['#b4b4b4', '#a6a6a6', '#989898', '#8a8a8a', '#7c7c7c', '#6e6e6e', '#606060'];
  for (let i = 0; i < greys.length - 1; i++) {
    const y0 = 137 + i * 13;
    rect(c, 0, y0, w, i === greys.length - 2 ? h - y0 : 13, dither(c, greys[i], greys[i + 1]));
  }
  for (const vx of [178, 245]) {
    c.fillStyle = '#5a5a5a';
    c.beginPath();
    c.ellipse(ox + vx, 146, 13, 4, 0, 0, Math.PI * 2);
    c.fill();
    rect(c, ox + vx - 9, 142, 18, 1, '#c8c8c8');
  }
  rect(c, ox + 200, 131, 32, 7, '#0c0c0c');
  radarLeds(c, ox + 202, 133, 28, r.radar);
  smallGauge(c, ox + 190, 198, 11, 0.5);
  smallGauge(c, ox + 250, 198, 11, 0.62);
  rect(c, ox + 206, 173, 32, 42, '#1e1e1e');
  rect(c, ox + 209, 176, 26, 36, dither(c, '#c4c4c4', '#d2d2d2'));
  for (const gx of [214, 221, 228]) rect(c, ox + gx, 184, 2, 24, '#3a3a3a');
  rect(c, ox + 214, 195, 16, 2, '#3a3a3a');
  const pos = [[215, 186], [215, 206], [222, 186], [222, 206], [229, 186]][r.gear];
  disc(c, ox + pos[0], pos[1] - 3, 6, '#9a9aa2');
  disc(c, ox + pos[0] - 2, pos[1] - 5, 2, '#ffffff');
  // nicho preto e mostradores fixos
  const wx = ox + 10, wy = 121, ww = 150, wh = 140, wr = 60, th = 15;
  c.fillStyle = '#080808';
  c.beginPath();
  c.roundRect(wx + th, wy + th, ww - th * 2, wh - th * 2, wr - th);
  c.fill();
  const cx = ox + 85;
  const kmh = Math.round(r.speed * KMH);
  gauge(c, cx - 21, 160, 22, ['0', '80', '160', '240', '320'], kmh / 360, 2, { digital: String(kmh), ring: '#3a3a3a' });
  gauge(c, cx + 23, 160, 22, ['0', '20', '40', '60', '80', '100'], 0.1 + Math.min(1, r.rpm) * 0.8, 0.78, { gear: String(r.gear + 1), ring: '#3a3a3a' });
  withRotation(c, cx, 198, steerAngle(r, dt), () => {
    // aro em "D" (anel: contorno externo menos o interno)
    c.fillStyle = dither(c, '#2a2a2a', '#343434');
    c.beginPath();
    c.roundRect(wx, wy, ww, wh, wr);
    c.roundRect(wx + th, wy + th, ww - th * 2, wh - th * 2, wr - th);
    c.fill('evenodd');
    rect(c, wx + wr - 8, wy, ww - 2 * (wr - 8), 1, '#8e8e8e');
    c.strokeStyle = dither(c, '#202020', '#2c2c2c');
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(cx - 67, 192);
    c.quadraticCurveTo(cx, 180, cx + 67, 192);
    c.stroke();
    c.fillStyle = '#121212';
    c.beginPath();
    c.ellipse(cx, 207, 17, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f0d018';
    c.beginPath();
    c.ellipse(cx, 207, 9, 7, 0, 0, Math.PI * 2);
    c.fill();
    disc(c, cx, wy + 6, 3, '#f0d020');
  });
}

// Aro com textura no estilo do jogo original
function rim(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, thick: number, base: [string, string], hi: string) {
  const mid = R - thick / 2;
  c.strokeStyle = dither(c, base[0], base[1]);
  c.lineWidth = thick;
  c.beginPath();
  c.arc(cx, cy, mid, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = hi;
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, R - 0.5, Math.PI * 1.12, Math.PI * 1.68);
  c.stroke();
  disc(c, cx, cy - R + thick * 0.4, 3, '#f0d020');
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
