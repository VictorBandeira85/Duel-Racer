import { view } from './config';
import type { Race } from './race';
import type { Viewport } from './render3d';

// Limpadores de para-brisa (todos os carros), desenhados em pixel nativo com meio pixel.
// Dois braços em tandem com o eixo escondido sob o painel; parados, as palhetas ficam
// deitadas na base do vidro, pontas para a direita. Na chuva e na neve eles varrem
// ~110° para a esquerda (até perto da coluna do motorista) e limpam o que acumulou no vidro:
// gotas na chuva (escorrem devagar), flocos na neve (empurrados para o fim da varredura).

const CYCLE = 1.25; // s por ida e volta, com uma pausa curta embaixo
const SWEEP = 1.92; // rad (~110°)
const MAX_PARTS = 260;

interface Part { x: number; y: number; s: number; snow: boolean; life: number; v: number }
const parts: Part[] = [];
let phase = 0;
let lastS = 0;
// película de água/neve no vidro, numa grade de células de CELL px: cada célula embaça aos
// poucos e só é limpa quando a palheta passa por ela (fora do alcance continua embaçada)
const CELL = 3;
let film = new Float32Array(0);
let filmW = 0, filmH = 0, filmY0 = 0;
let raceRef: Race | null = null;

// topo do painel em cada coluna da tela (para pôr o eixo escondido e a palheta deitada)
export type DashTop = (x: number) => number;

const ease = (t: number) => t * t * (3 - 2 * t);

// quanto da varredura já foi feito (0 = parado embaixo, 1 = no alto)
function sweepAt(p: number) {
  if (p < 0.42) return ease(p / 0.42);
  if (p < 0.84) return ease(1 - (p - 0.42) / 0.42);
  return 0;
}

// pontos do limpador: eixo (px, py), comprimento L, ângulo a (0 = para a direita, negativo
// sobe). O vidro é inclinado: na vertical tudo fica um pouco mais curto.
const FORE = 0.86;
function at(px: number, py: number, a: number, d: number): [number, number] {
  return [px + (Math.cos(a) * d) / view.aspect, py + Math.sin(a) * d * FORE];
}

// linha de meio pixel com espessura w (em pixels nativos)
function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, color: string) {
  c.fillStyle = color;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len * 4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round((x0 + (x1 - x0) * t) * 2) / 2, y = Math.round((y0 + (y1 - y0) * t) * 2) / 2;
    c.fillRect(x - w / 2 + 0.25, y - w / 2 + 0.25, w, w);
  }
}

function drawWiper(c: CanvasRenderingContext2D, px: number, py: number, L: number, a: number) {
  // tampa do eixo (porca com capa de borracha)
  c.fillStyle = '#0a0a0c';
  c.fillRect(Math.round(px * 2) / 2 - 1.5, Math.round(py * 2) / 2 - 1, 3, 2);
  c.fillStyle = '#3a3a40';
  c.fillRect(Math.round(px * 2) / 2 - 1, Math.round(py * 2) / 2 - 1, 1.5, 0.5);
  const n = a - Math.PI / 2; // perpendicular (para cima da palheta)
  const [ex, ey] = at(px, py, a, L * 0.58); // ponta do braço = centro da palheta
  // braço: capa da mola (mais grossa) perto do eixo, depois a haste fina com reflexo
  const [sx, sy] = at(px, py, a, L * 0.2);
  line(c, px, py, sx, sy, 2.5, '#0c0c0e');
  line(c, px, py, sx, sy, 1, '#2c2c30');
  line(c, sx, sy, ex, ey, 1.5, '#0e0e10');
  const [hx, hy] = at(px, py, a, L * 0.56);
  line(c, sx + Math.cos(n) * 0.4, sy + Math.sin(n) * 0.4, hx + Math.cos(n) * 0.4, hy + Math.sin(n) * 0.4, 0.5, '#3a3a40');
  // palheta: estrutura com garras, borracha embaixo, presa no meio
  const [b0x, b0y] = at(px, py, a, L * 0.12);
  const [b1x, b1y] = at(px, py, a, L);
  const off = (k: number): [number, number] => [Math.cos(n) * k / view.aspect, Math.sin(n) * k * FORE];
  const [ox1, oy1] = off(1.2);
  line(c, b0x + ox1, b0y + oy1, b1x + ox1, b1y + oy1, 1, '#141416'); // estrutura
  line(c, b0x, b0y, b1x, b1y, 0.5, '#050506'); // borracha
  for (let k = 0.16; k <= 0.97; k += 0.135) { // garras
    const [gx, gy] = at(px, py, a, L * k);
    line(c, gx, gy, gx + ox1 * 1.5, gy + oy1 * 1.5, 0.5, '#26262a');
  }
  const [cx2, cy2] = off(1.8);
  c.fillStyle = '#1c1c20'; // presilha no centro
  c.fillRect(Math.round((ex + cx2) * 2) / 2 - 1, Math.round((ey + cy2) * 2) / 2 - 1, 2, 2);
  c.fillStyle = '#4a4a50';
  c.fillRect(Math.round((ex + cx2) * 2) / 2 - 1, Math.round((ey + cy2) * 2) / 2 - 1, 1, 0.5);
}

export function drawWipers(c: CanvasRenderingContext2D, r: Race, vp: Viewport, dt: number, dashTop: DashTop, coreX: number) {
  if (raceRef !== r) {
    raceRef = r;
    parts.length = 0;
    phase = 0;
    lastS = 0;
    film = new Float32Array(0);
  }
  const w = r.def.weather;
  const on = !!w && r.state !== 'arrived';
  // eixos: um no meio-esquerdo, outro à direita do centro (sistema tandem)
  // o eixo fica rente à borda do painel; parada, a palheta acompanha a borda até a ponta
  const L = 96;
  const pivots = [coreX + 66, coreX + 168].map((x) => {
    const y = dashTop(Math.round(x)) + 1;
    const xe = x + (L * 0.95) / view.aspect;
    const ye = dashTop(Math.max(0, Math.min(view.w - 1, Math.round(xe)))) - 1.5;
    return { x, y, rest: Math.atan2((ye - y) / FORE, L * 0.95) };
  });

  // ---- o que cai e gruda no vidro ----
  if (w) {
    const top = vp.y + 2;
    const rate = (w === 'rain' ? 34 : 20) * (0.5 + r.speed / r.car.maxSpeed);
    let k = rate * dt;
    while (k > 0 && parts.length < MAX_PARTS) {
      if (Math.random() < k) {
        const x = Math.random() * view.w;
        const y = top + Math.random() * (dashTop(Math.max(0, Math.min(view.w - 1, Math.round(x)))) - top);
        parts.push({ x, y, s: Math.random() < 0.3 ? 2 : 1, snow: w === 'snow', life: w === 'rain' ? 4 + Math.random() * 4 : 999, v: Math.random() * 3 });
      }
      k -= 1;
    }
  }
  // ---- movimento dos braços ----
  if (on || phase > 0) {
    phase += dt / CYCLE;
    if (phase >= 1) phase = on ? phase - 1 : 0;
  }
  const sNow = sweepAt(phase);
  const up = sNow > lastS;
  const sLo = Math.min(sNow, lastS), sHi = Math.max(sNow, lastS);
  lastS = sNow;
  // película: embaça cada célula aos poucos; a palheta zera só as células por onde passou
  if (w) {
    const fw = Math.ceil(view.w / CELL), fy0 = vp.y, fh = Math.ceil((view.h - vp.y) / CELL);
    if (film.length !== fw * fh || filmY0 !== fy0) {
      film = new Float32Array(fw * fh);
      filmW = fw; filmH = fh; filmY0 = fy0;
    }
    const grow = dt * (w === 'rain' ? 0.45 : 0.22);
    for (let i = 0; i < film.length; i++) film[i] = Math.min(1, film[i] + grow);
    if (sHi > sLo) {
      for (const pv of pivots) {
        const lo = pv.rest - SWEEP * sHi - 0.04, hi = pv.rest - SWEEP * sLo + 0.04;
        for (let j = 0; j < filmH; j++) {
          const cy = filmY0 + (j + 0.5) * CELL;
          const dy = (cy - pv.y) / FORE;
          if (Math.abs(dy) > L + 2) continue;
          for (let i = 0; i < filmW; i++) {
            const dx = ((i + 0.5) * CELL - pv.x) * view.aspect;
            const rr = Math.hypot(dx, dy);
            if (rr < L * 0.1 || rr > L + 1) continue;
            const ang = Math.atan2(dy, dx);
            if (ang >= lo && ang <= hi) film[j * filmW + i] = 0;
          }
        }
      }
    }
  }
  // varridos: gotas somem; flocos vão para o fim da varredura (acumulam nas pontas)
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p.snow) {
      p.y += p.v * dt;
      p.life -= dt;
    }
    let hit = false;
    for (const pv of pivots) {
      const dx = (p.x - pv.x) * view.aspect, dy = (p.y - pv.y) / FORE;
      const rr = Math.hypot(dx, dy);
      if (rr < L * 0.1 || rr > L + 1.5) continue;
      const ang = Math.atan2(dy, dx);
      const lo = pv.rest - SWEEP * sHi - 0.03, hi = pv.rest - SWEEP * sLo + 0.03;
      if (sHi > sLo && ang >= lo && ang <= hi) {
        hit = true;
        if (p.snow && Math.random() < 0.45) {
          const na = up ? pv.rest - SWEEP - 0.06 : pv.rest + 0.08;
          [p.x, p.y] = at(pv.x, pv.y, na, rr);
          hit = false;
        }
        break;
      }
    }
    if (hit || p.life <= 0) parts.splice(i, 1);
  }
  // ---- desenho: gotas/flocos, depois os braços ----
  c.save();
  c.beginPath();
  c.rect(vp.x, vp.y, vp.w, view.h - vp.y);
  c.clip();
  // película: desenhada em faixas por linha, com a opacidade em 6 níveis
  if (w && film.length) {
    const base = w === 'rain' ? [170, 190, 215, 0.16] : [235, 240, 250, 0.22];
    for (let j = 0; j < filmH; j++) {
      let i = 0;
      while (i < filmW) {
        const q = Math.round(film[j * filmW + i] * 5);
        let k = i + 1;
        while (k < filmW && Math.round(film[j * filmW + k] * 5) === q) k++;
        if (q > 0) {
          c.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${(base[3] * q) / 5})`;
          c.fillRect(i * CELL, filmY0 + j * CELL, (k - i) * CELL, CELL);
        }
        i = k;
      }
    }
  }
  for (const p of parts) {
    const x = Math.round(p.x * 2) / 2, y = Math.round(p.y * 2) / 2;
    if (p.snow) {
      // floco: centro branco e borda azulada
      const s = p.s === 2 ? 1.5 : 1;
      c.fillStyle = 'rgba(190,205,230,0.8)';
      c.fillRect(x - 0.5, y - 0.5, s + 1, s + 1);
      c.fillStyle = '#fbfdff';
      c.fillRect(x, y, s, s);
    } else {
      // gota: um pixel de água com brilho em cima e sombra embaixo (lente)
      const s = p.s === 2 ? 1.5 : 1;
      c.fillStyle = 'rgba(150,175,205,0.45)';
      c.fillRect(x, y, s, s);
      c.fillStyle = 'rgba(245,250,255,0.85)';
      c.fillRect(x, y, 0.5, 0.5);
      c.fillStyle = 'rgba(15,25,45,0.45)';
      c.fillRect(x, y + s, s, 0.5);
    }
  }
  for (const pv of pivots) drawWiper(c, pv.x, pv.y, L, pv.rest - SWEEP * sNow);
  c.restore();
}
