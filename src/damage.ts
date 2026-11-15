// Acidentes em pixel art: trincas do para-brisa (camada em cache, na resolução fina, refeita só quando
// o dano muda), faíscas e estilhaços da batida e as marcas nos carros batidos (trânsito, rival e o carro
// do jogador visto de fora). Tudo desenhado por código, sem arte nova.
import { CRES } from './config';
import { rng } from './util';

export interface Dent { v: number; side: number; seed: number } // v 0..1 (0,3 raspão, 0,5 batida leve, 1 batida)

// ---------------- para-brisa ----------------
// mark: ponto (0..1 do para-brisa), tamanho, semente; star = estrelinha de pedra, big = estilhaço de batida
export interface GlassMark { x: number; y: number; size: number; seed: number; star: boolean; big?: boolean }

const glassCv = document.createElement('canvas');
const glassCtx = glassCv.getContext('2d')!;
let glassKey = '';
// área usada da camada (em pixels da camada): só ela é desenhada na tela (custa menos que o vidro todo)
const gb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };

// pixel fino: q = tamanho do traço em pixels da camada (meio pixel do jogo em CRES 4)
function plot(g: CanvasRenderingContext2D, x: number, y: number, q: number) {
  const X = Math.round(x / q) * q, Y = Math.round(y / q) * q;
  if (X < gb.x0) gb.x0 = X;
  if (Y < gb.y0) gb.y0 = Y;
  if (X + q > gb.x1) gb.x1 = X + q;
  if (Y + q > gb.y1) gb.y1 = Y + q;
  g.fillRect(X, Y, q, q);
}
function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, q: number) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / q));
  for (let i = 0; i <= n; i++) plot(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, q);
}

// raios ramificados a partir do ponto de impacto; devolve as polilinhas (para os anéis ligarem os raios)
function rays(rand: () => number, n: number, len: number, step: number, wob: number, branch: number) {
  const out: number[][] = [];
  const grow = (x: number, y: number, a: number, l: number, depth: number) => {
    const pts = [x, y];
    let d = 0;
    while (d < l) {
      a += (rand() - 0.5) * wob;
      const s = step * (0.7 + rand() * 0.6);
      x += Math.cos(a) * s;
      y += Math.sin(a) * s * 0.8;
      d += s;
      pts.push(x, y);
      if (depth < 2 && rand() < branch) grow(x, y, a + (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.5), (l - d) * (0.35 + rand() * 0.3), depth + 1);
    }
    out.push(pts);
  };
  for (let i = 0; i < n; i++) grow(0, 0, (i / n) * Math.PI * 2 + rand() * 0.45, len * (0.55 + rand() * 0.6), 0);
  return out;
}

function buildGlass(marks: GlassMark[], w: number, h: number) {
  const S = CRES;
  glassCv.width = Math.max(1, Math.round(w * S));
  glassCv.height = Math.max(1, Math.round(h * S));
  const g = glassCtx;
  g.clearRect(0, 0, glassCv.width, glassCv.height);
  gb.x0 = gb.y0 = 1e9;
  gb.x1 = gb.y1 = -1e9;
  const q = Math.max(1, Math.round(S / 2)); // traço de meio pixel do jogo
  for (const m of marks) {
    const rand = rng(m.seed);
    const ox = m.x * w * S, oy = m.y * h * S;
    const k = (0.5 + m.size) * S;
    const big = !!m.big;
    const n = m.star ? 5 + Math.floor(rand() * 3) : big ? 9 + Math.floor(rand() * 2) : 6 + Math.floor(rand() * 3);
    const len = m.star ? 5 * k : big ? w * S * 0.2 : (14 + rand() * 14) * k;
    const rl = rays(rand, n, len, (m.star ? 1.6 : big ? 7 : 4.5) * S, m.star ? 0.25 : 0.55, m.star ? 0 : big ? 0.12 : 0.1);
    // anéis concêntricos: ligam pontos dos raios vizinhos à mesma distância (teia), com falhas
    const rings: number[][] = [];
    if (!m.star) {
      const radii = big ? [7, 15, 24] : [5, 10];
      for (const rr of radii) {
        const R = rr * k * (big ? 0.9 : 0.7);
        const ring: number[] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rand() * 0.3;
          ring.push(Math.cos(a) * R * (0.85 + rand() * 0.3), Math.sin(a) * R * 0.8 * (0.85 + rand() * 0.3));
        }
        rings.push(ring);
      }
    }
    // sombra escura (1 px do jogo abaixo e à direita) e o traço claro por cima
    for (const pass of [0, 1]) {
      g.fillStyle = pass ? 'rgba(236,243,250,0.9)' : 'rgba(14,18,26,0.42)';
      const d = pass ? 0 : S;
      for (const p of rl) for (let i = 2; i < p.length; i += 2) line(g, ox + p[i - 2] + d * 0.5, oy + p[i - 1] + d, ox + p[i] + d * 0.5, oy + p[i + 1] + d, q);
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          if (rand() < (big ? 0.18 : 0.35)) continue; // falhas no anel
          const j = (i + 2) % ring.length;
          line(g, ox + ring[i] + d * 0.5, oy + ring[i + 1] + d, ox + ring[j] + d * 0.5, oy + ring[j + 1] + d, q);
        }
      }
    }
    // miolo moído: vidro esbranquiçado em grãos no ponto do impacto (maior na batida)
    const core = (m.star ? 2 : big ? 9 : 4) * S;
    for (let i = 0; i < (m.star ? 6 : big ? 90 : 26); i++) {
      const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * core;
      g.fillStyle = rand() < 0.7 ? 'rgba(238,244,250,0.85)' : 'rgba(170,186,204,0.7)';
      plot(g, ox + Math.cos(a) * rr, oy + Math.sin(a) * rr * 0.8, q);
    }
    if (big) {
      // véu leitoso em volta do estilhaço (vidro laminado trincado em pó), em anéis pontilhados
      for (let ring = 1; ring <= 3; ring++) {
        const R = ring * 8 * S;
        g.fillStyle = `rgba(225,232,240,${(0.22 / ring).toFixed(3)})`;
        for (let i = 0; i < 70 * ring; i++) {
          const a = rand() * Math.PI * 2, rr = R * (0.6 + rand() * 0.5);
          plot(g, ox + Math.cos(a) * rr, oy + Math.sin(a) * rr * 0.8, q);
        }
      }
    }
  }
}

// marcas do para-brisa (presas ao vidro: o vp acompanha o tremor da cabine); glow 0..1 = faróis de quem
// vem de frente batendo nas trincas à noite ou na chuva (brilho morno sutil)
export function drawGlass(c: CanvasRenderingContext2D, marks: GlassMark[], vp: { x: number; y: number; w: number; h: number }, glow: number) {
  if (!marks.length) return;
  const key = `${CRES}|${Math.round(vp.w)}|${Math.round(vp.h)}|${marks.map((m) => `${m.seed}${m.big ? 'b' : ''}`).join(',')}`;
  if (key !== glassKey) {
    glassKey = key;
    buildGlass(marks, vp.w, vp.h);
  }
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.save();
  const S = CRES;
  const x0 = Math.max(0, gb.x0), y0 = Math.max(0, gb.y0), x1 = Math.min(glassCv.width, gb.x1), y1 = Math.min(glassCv.height, gb.y1);
  if (x1 > x0 && y1 > y0) {
    const blit = () => c.drawImage(glassCv, x0, y0, x1 - x0, y1 - y0, vp.x + x0 / S, vp.y + y0 / S, (x1 - x0) / S, (y1 - y0) / S);
    c.globalAlpha = 0.85;
    blit();
    if (glow > 0.02) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(0.55, glow * 0.55);
      blit();
    }
  }
  c.restore();
  c.imageSmoothingEnabled = sm;
}

// ---------------- batida: faíscas e estilhaços ----------------
// t = tempo desde o impacto; (ox, oy) = ponto do impacto na tela; side = lado da batida (-1 esquerda);
// base = linha do capô (de onde saem as faíscas); body = cor da lataria
export function drawCrashFx(c: CanvasRenderingContext2D, t: number, seed: number, ox: number, oy: number, side: number, baseX: number, baseY: number, body: string) {
  if (t > 1.2) return;
  const rand = rng(seed * 31 + 5);
  // faíscas: lata raspando, saem da frente do carro do lado da batida, riscos amarelos que viram laranja
  if (t < 0.55) {
    for (let i = 0; i < 34; i++) {
      const a = -Math.PI / 2 + side * (0.25 + rand() * 1.1) + (rand() - 0.5) * 0.5;
      const sp = 90 + rand() * 170;
      const born = rand() * 0.18;
      const tt = t - born;
      if (tt <= 0 || tt > 0.38) continue;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      const x = baseX + vx * tt, y = baseY + vy * tt + 260 * tt * tt;
      const age = tt / 0.38;
      c.fillStyle = age < 0.35 ? '#fff6c8' : age < 0.7 ? '#ffc23a' : '#ff6a1a';
      // risco de 2-3 px na direção do voo
      const ux = vx / sp, uy = (vy + 520 * tt) / sp;
      for (let s = 0; s < 3 - Math.floor(age * 2); s++) c.fillRect(Math.round(x - ux * s), Math.round(y - uy * s), 1, 1);
    }
  }
  // estilhaços: vidro (lascas claras com brilho que pisca ao girar), plástico escuro e lascas de tinta
  for (let i = 0; i < 30; i++) {
    const a = rand() * Math.PI * 2, sp = 50 + rand() * 150;
    const x = ox + Math.cos(a) * sp * t, y = oy + Math.sin(a) * sp * t * 0.8 + 170 * t * t;
    const kind = rand();
    const fade = 1 - t / 1.2;
    const spin = Math.floor(t * 14 + i) % 3;
    const X = Math.round(x), Y = Math.round(y);
    if (kind < 0.55) {
      c.fillStyle = `rgba(222,236,248,${(0.9 * fade).toFixed(2)})`;
      if (spin === 0) c.fillRect(X, Y, 2, 1);
      else if (spin === 1) c.fillRect(X, Y, 1, 2);
      else c.fillRect(X, Y, 2, 2);
      c.fillStyle = `rgba(255,255,255,${fade.toFixed(2)})`;
      if (spin !== 1) c.fillRect(X, Y, 1, 1);
    } else if (kind < 0.8) {
      c.fillStyle = `rgba(36,36,40,${fade.toFixed(2)})`;
      c.fillRect(X, Y, spin ? 2 : 1, spin ? 1 : 2);
    } else {
      c.globalAlpha = fade;
      c.fillStyle = body;
      c.fillRect(X, Y, 1 + (spin & 1), 1);
      c.globalAlpha = 1;
    }
  }
}

// ---------------- carros batidos (traseira/frente vistas na pista) ----------------
// (x, y) = meio da base do sprite, w = largura, h = altura; front = vista de frente
export function drawDent(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: Dent, front: boolean) {
  if (d.v <= 0.05 || w < 6) return;
  const rand = rng(d.seed);
  const p = Math.max(1, Math.round(w / 64)); // pixel do desenho
  const L = x - w / 2, T = y - h;
  const sx = (u: number) => L + (d.side < 0 ? u : 1 - u) * w; // u medido a partir do lado batido
  const R = (col: string, u: number, f: number, uw: number, fh: number) => {
    const a = sx(u), b = sx(u + uw);
    c.fillStyle = col;
    c.fillRect(Math.round(Math.min(a, b) / p) * p, Math.round((T + f * h) / p) * p, Math.max(p, Math.round(Math.abs(b - a) / p) * p), Math.max(p, Math.round((fh * h) / p) * p));
  };
  // amassado: lata afundada no canto batido (sombra irregular em degraus, mais funda no canto) com
  // vinco claro em cima e a borda da lata dobrada
  const depth = Math.min(1, d.v);
  const dw = 0.22 + depth * 0.22;
  for (let i = 0; i < 7; i++) {
    const u = (i / 7) * dw;
    const k = 1 - i / 8;
    const f0 = 0.4 + rand() * 0.05, fh = (0.16 + rand() * 0.08 + depth * 0.18) * k;
    R(`rgba(0,0,0,${(0.3 + 0.25 * k).toFixed(2)})`, u, f0, dw / 7 + 0.006, fh);
    R('rgba(0,0,0,0.25)', u, f0 + fh * 0.55, dw / 7 + 0.006, fh * 0.3); // fundo da dobra
  }
  R('rgba(255,255,255,0.4)', dw * 0.1, 0.39, dw * 0.8, 0.02); // vinco
  R('rgba(0,0,0,0.6)', 0, 0.37, dw * 0.95, 0.02);
  // pintura arranhada mostrando o metal
  for (let i = 0; i < 6 + depth * 8; i++) R(rand() < 0.5 ? '#c4c9d0' : '#8b9099', rand() * dw * 1.1, 0.4 + rand() * 0.28, 0.025 + rand() * 0.04, 0.018);
  if (d.v >= 0.45) {
    // lanterna/farol do lado batido quebrado e apagado: lente escura com cacos claros
    R('#141012', 0.03, 0.5, 0.17, 0.12);
    R(front ? 'rgba(230,236,244,0.85)' : 'rgba(255,110,90,0.8)', 0.06, 0.52, 0.035, 0.03);
    R(front ? 'rgba(230,236,244,0.65)' : 'rgba(255,110,90,0.6)', 0.12, 0.57, 0.03, 0.025);
    R(front ? 'rgba(230,236,244,0.5)' : 'rgba(255,110,90,0.5)', 0.09, 0.6, 0.02, 0.02);
    // vidro trincado (o de trás ou o para-brisa): estrela com raios claros
    const cx0 = sx(0.32), cy0 = T + 0.22 * h;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
      let px = cx0, py = cy0;
      for (let st = 0; st < 3 + rand() * 5; st++) {
        px += Math.cos(a + (rand() - 0.5) * 0.6) * p * 1.6;
        py += Math.sin(a + (rand() - 0.5) * 0.6) * p * 1.1;
        c.fillStyle = 'rgba(15,18,24,0.5)';
        c.fillRect(Math.round(px / p) * p, Math.round(py / p) * p + p, p, p);
        c.fillStyle = 'rgba(238,244,250,0.85)';
        c.fillRect(Math.round(px / p) * p, Math.round(py / p) * p, p, p);
      }
    }
  }
  if (d.v >= 0.8) {
    // para-choque solto: a ponta do lado batido caída, arrastando no chão
    c.fillStyle = '#1c1c20';
    const a = sx(0), b = sx(0.32);
    const xa = Math.min(a, b), xb = Math.max(a, b);
    const yTop = y - h * 0.16;
    for (let xx = xa; xx < xb; xx += p) {
      const u = d.side < 0 ? (xx - xa) / (xb - xa) : 1 - (xx - xa) / (xb - xa);
      const drop = (1 - u) * h * 0.14;
      c.fillRect(Math.round(xx / p) * p, Math.round((yTop + drop) / p) * p, p, Math.max(p, Math.round((h * 0.06) / p) * p));
    }
  }
}

// carro do jogador visto de lado (tela do posto): riscos, amassados e vidro trincado por cima do
// sprite, só onde o carro é opaco (a camada é recortada pelo próprio desenho)
const sideCv = document.createElement('canvas');
export function drawSideDamage(c: CanvasRenderingContext2D, draw: (g: CanvasRenderingContext2D) => void, box: { x: number; y: number; w: number; h: number }, level: number, seed: number) {
  if (level <= 0.05) return draw(c);
  const S = CRES;
  const W = Math.ceil(box.w * S), H = Math.ceil(box.h * S);
  if (sideCv.width !== W || sideCv.height !== H) { sideCv.width = W; sideCv.height = H; }
  const g = sideCv.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.setTransform(S, 0, 0, S, -box.x * S, -box.y * S);
  g.imageSmoothingEnabled = false;
  draw(g);
  g.globalCompositeOperation = 'source-atop';
  const rand = rng(seed);
  const p = 1;
  const n = Math.round(3 + level * 7);
  for (let i = 0; i < n; i++) {
    // amassado: mancha escura com vinco claro, na faixa da lataria (meio de baixo do carro)
    const ux = box.x + box.w * (0.12 + rand() * 0.76), uy = box.y + box.h * (0.5 + rand() * 0.25);
    const dw = box.w * (0.04 + rand() * 0.06 * level), dh = box.h * (0.06 + rand() * 0.06);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fillRect(Math.round(ux), Math.round(uy), Math.round(dw), Math.round(dh));
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(Math.round(ux), Math.round(uy), Math.round(dw), p);
  }
  for (let i = 0; i < n * 2; i++) {
    // riscos com metal à mostra
    const ux = box.x + box.w * (0.1 + rand() * 0.8), uy = box.y + box.h * (0.45 + rand() * 0.3);
    g.fillStyle = rand() < 0.5 ? '#c3c7ce' : '#8d929a';
    g.fillRect(Math.round(ux), Math.round(uy), Math.round(2 + rand() * 6), p);
  }
  g.globalCompositeOperation = 'source-over';
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(sideCv, box.x, box.y, box.w, box.h);
  c.imageSmoothingEnabled = sm;
}
