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

// ---------------- marcas recortadas pela própria arte ----------------
// O carro é desenhado duas vezes com cores de pintura diferentes num rascunho pequeno: o que muda de
// cor é lataria, o que não muda é vidro, lanterna, para-choque, pneu. As marcas só entram onde cabem:
// amassado e risco na lataria, trinca dentro do vidro de verdade, lente quebrada em cima da lanterna.
interface Layer { w: number; h: number; sil: Uint8Array; body: Uint8Array; glass: Uint8Array; px: Uint8ClampedArray; out: Uint8ClampedArray; x0: number; y0: number; x1: number; y1: number; painted: boolean }

function analyze(A: ImageData, B: ImageData): Layer {
  const w = A.width, h = A.height, a = A.data, b = B.data;
  const sil = new Uint8Array(w * h), body = new Uint8Array(w * h), glass = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, nb = 0;
  for (let i = 0, k = 0; i < w * h; i++, k += 4) {
    if (a[k + 3] < 200) continue;
    sil[i] = 1;
    const x = i % w, y = (i - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 90) { body[i] = 1; nb++; }
  }
  const L: Layer = { w, h, sil, body, glass, px: a, out: new Uint8ClampedArray(w * h * 4), x0, y0, x1, y1, painted: nb > 40 };
  if (x1 < 0) return L;
  // vidro: na metade de cima, sem tinta, tom de vidro (azulado/cinza, nem contorno preto nem branco)
  const H = y1 - y0 + 1;
  const cand = new Uint8Array(w * h);
  for (let y = y0 + Math.round(H * 0.05); y < y0 + Math.round(H * 0.6); y++) for (let x = x0; x <= x1; x++) {
    const i = y * w + x, k = i * 4;
    if (!sil[i] || body[i]) continue;
    const r = a[k], g = a[k + 1], bl = a[k + 2], lum = r * 0.3 + g * 0.59 + bl * 0.11;
    if (lum > 30 && lum < 215 && bl >= r - 6 && bl >= g - 26 && !(r > 150 && g < 100)) cand[i] = 1;
  }
  // a maior mancha ligada é o vidro
  let best: number[] = [];
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!cand[i] || seen[i]) continue;
    const st = [i], comp: number[] = [];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop()!;
      comp.push(j);
      const x = j % w;
      for (const n of [j - 1, j + 1, j - w, j + w]) {
        if (n < 0 || n >= w * h || seen[n] || !cand[n]) continue;
        if ((n === j - 1 && x === 0) || (n === j + 1 && x === w - 1)) continue;
        seen[n] = 1;
        st.push(n);
      }
    }
    if (comp.length > best.length) best = comp;
  }
  if (best.length >= Math.max(24, (x1 - x0 + 1) * H * 0.02)) for (const j of best) glass[j] = 1;
  return L;
}

function put(L: Layer, x: number, y: number, r: number, g: number, b: number, al: number, allow?: Uint8Array) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
  const i = y * L.w + x;
  if (!L.sil[i] || (allow && !allow[i])) return;
  const o = L.out, k = i * 4, a0 = o[k + 3] / 255, a1 = al + a0 * (1 - al);
  if (a1 <= 0) return;
  o[k] = (r * al + o[k] * a0 * (1 - al)) / a1;
  o[k + 1] = (g * al + o[k + 1] * a0 * (1 - al)) / a1;
  o[k + 2] = (b * al + o[k + 2] * a0 * (1 - al)) / a1;
  o[k + 3] = a1 * 255;
}

// amassado: mancha irregular (lata afundada: mais escura no fundo), borda de cima na sombra, borda de
// baixo pegando luz e um vinco quebrado atravessando
function dentBlob(L: Layer, rand: () => number, cx: number, cy: number, rx: number, ry: number, allow: Uint8Array) {
  const es: number[][] = [];
  for (let i = 0; i < 4; i++) es.push([cx + (rand() - 0.5) * rx * 1.1, cy + (rand() - 0.5) * ry * 0.9, rx * (0.45 + rand() * 0.5), ry * (0.45 + rand() * 0.5)]);
  const X0 = Math.max(0, Math.floor(cx - rx * 1.6)), X1 = Math.min(L.w - 1, Math.ceil(cx + rx * 1.6));
  const Y0 = Math.max(0, Math.floor(cy - ry * 1.5)), Y1 = Math.min(L.h - 1, Math.ceil(cy + ry * 1.5));
  const bw = X1 - X0 + 1, bh = Y1 - Y0 + 1;
  if (bw <= 0 || bh <= 0) return;
  const m = new Float32Array(bw * bh);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    let t = 0;
    for (const [ex, ey, erx, ery] of es) t = Math.max(t, 1 - ((x - ex) / erx) ** 2 - ((y - ey) / ery) ** 2);
    if (t > 0 && allow[y * L.w + x]) m[(y - Y0) * bw + (x - X0)] = t;
  }
  const at = (x: number, y: number) => (x < X0 || x > X1 || y < Y0 || y > Y1 ? 0 : m[(y - Y0) * bw + (x - X0)]);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const t = at(x, y);
    if (t <= 0) continue;
    put(L, x, y, 0, 0, 0, 0.16 + 0.3 * Math.min(1, t * 1.4));
    if (at(x, y - 1) <= 0) put(L, x, y, 0, 0, 0, 0.4); // lábio de cima, na sombra
    else if (at(x, y + 1) <= 0) put(L, x, y, 255, 255, 255, 0.34); // lábio de baixo, na luz
  }
  // vinco: linha quebrada escura com um fio claro embaixo
  let vy = cy + (rand() - 0.5) * ry * 0.5;
  for (let x = Math.round(cx - rx * 0.8); x <= cx + rx * 0.8; x++) {
    if (rand() < 0.35) vy += rand() < 0.5 ? -1 : 1;
    if (at(x, Math.round(vy)) <= 0) continue;
    put(L, x, vy, 0, 0, 0, 0.5);
    put(L, x, vy + 1, 255, 255, 255, 0.28);
  }
}

// riscos: tinta arrancada mostrando o metal, fios curtos levemente inclinados
function scratches(L: Layer, rand: () => number, cx: number, cy: number, sx: number, sy: number, n: number, allow: Uint8Array, len = 7) {
  for (let i = 0; i < n; i++) {
    let x = cx + (rand() - 0.5) * 2 * sx, y = cy + (rand() - 0.5) * 2 * sy;
    const l = 2 + rand() * len, sl = (rand() - 0.5) * 0.5, bright = rand() < 0.55;
    for (let k = 0; k < l; k++, x++, y += sl) {
      if (bright) put(L, x, y, 204, 209, 216, 0.92, allow);
      else put(L, x, y, 132, 138, 148, 0.85, allow);
      if (k % 3 === 0) put(L, x, y + 1, 0, 0, 0, 0.3, allow);
    }
  }
}

// trinca pequena dentro do vidro (só pixels de vidro): estrela de raios claros com sombra
function glassCrack(L: Layer, rand: () => number, cx: number, cy: number, len: number) {
  for (let i = 0; i < 6; i++) {
    let a = (i / 6) * Math.PI * 2 + rand() * 0.6, x = cx, y = cy;
    const l = len * (0.5 + rand() * 0.6);
    for (let k = 0; k < l; k++) {
      a += (rand() - 0.5) * 0.5;
      x += Math.cos(a);
      y += Math.sin(a) * 0.8;
      put(L, x, y + 1, 12, 16, 24, 0.45, L.glass);
      put(L, x, y, 236, 242, 250, 0.9, L.glass);
    }
  }
  put(L, cx, cy, 255, 255, 255, 0.95, L.glass);
}

const tmpCv = [document.createElement('canvas'), document.createElement('canvas')];
function twoRenders(W: number, H: number, render: (g: CanvasRenderingContext2D, color: string) => boolean): [ImageData, ImageData] | null {
  const out: ImageData[] = [];
  for (let i = 0; i < 2; i++) {
    const cv = tmpCv[i];
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    g.save();
    const ok = render(g, i ? '#00b000' : '#ff00ff');
    g.restore();
    if (!ok) return null;
    out.push(g.getImageData(0, 0, W, H));
  }
  return [out[0], out[1]];
}
function layerCanvas(L: Layer) {
  const cv = document.createElement('canvas');
  cv.width = L.w;
  cv.height = L.h;
  const id = new ImageData(L.w, L.h);
  id.data.set(L.out);
  cv.getContext('2d')!.putImageData(id, 0, 0);
  return cv;
}

// ---------------- carros batidos (traseira/frente vistas na pista) ----------------
// rascunho de referência: carro com DCAR px de largura, base em DBASE, centrado
export const DENT_W = 96, DENT_H = 132, DENT_CAR = 88, DENT_BASE = 128;
const dentCache = new Map<string, HTMLCanvasElement>();

function buildDent(L: Layer, d: Dent, front: boolean) {
  const rand = rng(d.seed);
  const W = L.x1 - L.x0 + 1, H = L.y1 - L.y0 + 1;
  const hx = (u: number) => (d.side < 0 ? L.x0 + u * W : L.x1 - u * W); // u medido a partir do lado batido
  const depth = Math.min(1, d.v);
  // onde a lata pode amassar: lataria pintada (sem tinta trocável: tudo que não é vidro nem contorno)
  const allow = new Uint8Array(L.w * L.h);
  for (let i = 0; i < allow.length; i++) {
    if (!L.sil[i] || L.glass[i]) continue;
    if (L.painted) allow[i] = L.body[i];
    else { const k = i * 4, lum = L.px[k] * 0.3 + L.px[k + 1] * 0.59 + L.px[k + 2] * 0.11; allow[i] = lum > 45 ? 1 : 0; }
  }
  // faixa da lataria: abaixo do vidro, acima do para-choque
  let gy1 = L.y0 + H * 0.42;
  for (let i = 0; i < L.glass.length; i++) if (L.glass[i]) gy1 = Math.max(gy1, Math.floor(i / L.w));
  const yTop = Math.min(gy1 + 2, L.y0 + H * 0.6), yBot = L.y1 - H * 0.2;
  const cy = (yTop + yBot) / 2;
  dentBlob(L, rand, hx(0.16 + depth * 0.04), cy, W * (0.08 + depth * 0.1), Math.max(3, (yBot - yTop) * (0.28 + depth * 0.22)), allow);
  if (depth > 0.55) dentBlob(L, rand, hx(0.36), cy + (rand() - 0.5) * 4, W * 0.07, Math.max(2, (yBot - yTop) * 0.25), allow);
  scratches(L, rand, hx(0.2), cy, W * 0.2, (yBot - yTop) * 0.5, Math.round(4 + depth * 9), allow, 5 + depth * 5);
  if (d.v >= 0.45) {
    // lanterna/farol do lado batido: a lente (achada na arte) fica escura, com cacos da cor dela
    const cand: number[] = [];
    for (let y = Math.round(L.y0 + H * 0.3); y < L.y1 - H * 0.08; y++) for (let k = 0; k < W * 0.36; k++) {
      const x = Math.round(hx(k / W)), i = y * L.w + x, q = i * 4;
      if (!L.sil[i] || L.body[i] || L.glass[i]) continue;
      const r = L.px[q], g = L.px[q + 1], b = L.px[q + 2];
      if (front ? r > 200 && g > 190 && b > 150 : r > 140 && g < 105 && b < 105) cand.push(i);
    }
    if (cand.length >= 4 && cand.length < W * H * 0.035) { // mancha grande = lataria branca, não lente
      for (const i of cand) {
        const x = i % L.w, y = (i - x) / L.w, q = i * 4;
        if (rand() < 0.14) put(L, x, y, L.px[q], L.px[q + 1], L.px[q + 2], 0.25);
        else put(L, x, y, 20, 16, 20, 0.86);
      }
    }
    // vidro trincado: só se a arte tem vidro, pequeno, dentro dele, do lado batido
    let gx0 = L.w, gx1 = -1, gy0 = L.h, gyb = -1;
    for (let i = 0; i < L.glass.length; i++) if (L.glass[i]) { const x = i % L.w, y = (i - x) / L.w; if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gyb) gyb = y; }
    if (gx1 > gx0) {
      const gw = gx1 - gx0, gh = gyb - gy0;
      const tx = d.side < 0 ? gx0 + gw * 0.3 : gx1 - gw * 0.3, ty = gy0 + gh * (0.45 + rand() * 0.2);
      glassCrack(L, rand, tx, ty, Math.max(3, Math.min(gw * 0.15, gh * 0.5, 9) * (0.6 + depth * 0.5)));
    }
  }
  if (d.v >= 0.8) {
    // para-choque solto do lado batido: fresta escura inclinada entre ele e a lataria, e a ponta riscada
    const y0 = L.y1 - H * 0.24;
    for (let k = 0; k < W * 0.36; k++) {
      const x = hx(k / W), y = y0 + (1 - k / (W * 0.36)) * H * 0.07;
      put(L, x, y, 0, 0, 0, 0.75);
      put(L, x, y + 1, 0, 0, 0, 0.5);
      if (k % 4 === 1) put(L, x, y + 3, 190, 196, 204, 0.6);
    }
  }
}

// marcas do carro batido por cima do sprite: key identifica a arte; render desenha o carro (sem as
// marcas) no rascunho de referência com a cor dada e diz se a arte já carregou
export function drawDent(c: CanvasRenderingContext2D, key: string, render: (g: CanvasRenderingContext2D, color: string) => boolean, x: number, y: number, w: number, d: Dent, front: boolean) {
  if (d.v <= 0.05 || w < 6) return;
  const k = `${key}|${front ? 'f' : 'r'}|${d.seed}|${Math.round(d.v * 10)}|${d.side < 0 ? 'l' : 'r'}`;
  let cv = dentCache.get(k);
  if (!cv) {
    const two = twoRenders(DENT_W, DENT_H, render);
    if (!two) return; // arte ainda carregando: sem marcas por enquanto
    const L = analyze(two[0], two[1]);
    if (L.x1 < 0) return;
    buildDent(L, d, front);
    cv = layerCanvas(L);
    if (dentCache.size > 80) dentCache.clear();
    dentCache.set(k, cv);
  }
  const sc = w / DENT_CAR;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, x - (DENT_W / 2) * sc, y - DENT_BASE * sc, DENT_W * sc, DENT_H * sc);
  c.imageSmoothingEnabled = sm;
}

// carro do jogador visto de lado (tela do posto): amassados e riscos em pixel art por cima do sprite,
// só na lataria (rodas, vidros e frisos ficam de fora) e recortados pelo próprio desenho
const sideCv = document.createElement('canvas');
let sideKey = '', sideLayer: HTMLCanvasElement | null = null;
const SIDE_S = 2; // marcas em meio pixel do jogo (a arte da lateral é mais fina que isso)
export function drawSideDamage(c: CanvasRenderingContext2D, draw: (g: CanvasRenderingContext2D, paint?: string) => void, box: { x: number; y: number; w: number; h: number }, level: number, seed: number) {
  if (level <= 0.05) return draw(c);
  const key = `${seed}|${Math.round(level * 10)}|${box.w}|${box.h}`;
  if (key !== sideKey || !sideLayer) {
    const two = twoRenders(Math.ceil(box.w * SIDE_S), Math.ceil(box.h * SIDE_S), (g, color) => {
      g.setTransform(SIDE_S, 0, 0, SIDE_S, -box.x * SIDE_S, -box.y * SIDE_S);
      draw(g, color);
      return true;
    });
    const L = two && analyze(two[0], two[1]);
    if (!L || !L.painted) return draw(c); // arte ainda carregando
    const rand = rng(seed);
    const W = L.x1 - L.x0 + 1, H = L.y1 - L.y0 + 1;
    const allow = L.body;
    const spots: number[] = [];
    for (let y = Math.round(L.y0 + H * 0.38); y < L.y1 - H * 0.12; y += 2) for (let x = L.x0 + 4; x < L.x1 - 4; x += 2) if (allow[y * L.w + x]) spots.push(y * L.w + x);
    const pick = () => { const i = spots[Math.floor(rand() * spots.length)] ?? 0; return [i % L.w, Math.floor(i / L.w)]; };
    const n = spots.length ? Math.round(2 + level * 4) : 0;
    for (let i = 0; i < n; i++) {
      const [px, py] = pick();
      dentBlob(L, rand, px, py, W * (0.022 + rand() * 0.03 * (0.5 + level)), H * (0.05 + rand() * 0.05 * (0.5 + level)), allow);
      scratches(L, rand, px, py, W * 0.05, H * 0.07, Math.round(2 + level * 4), allow, 8);
    }
    // raspão comprido ao longo da lateral (guard-rail, outro carro)
    for (let i = 0; i < Math.round(level * 3); i++) {
      const [px, py] = pick();
      let y = py;
      const l = W * (0.08 + rand() * 0.14);
      for (let k = 0; k < l; k++) {
        if (rand() < 0.12) y += rand() < 0.5 ? -1 : 1;
        if (rand() < 0.1) continue;
        put(L, px + k, y, 200, 205, 213, 0.9, allow);
        put(L, px + k, y + 1, 0, 0, 0, 0.32, allow);
      }
    }
    if (level > 0.55) {
      let gx0 = L.w, gx1 = -1, gy0 = L.h, gyb = -1;
      for (let i = 0; i < L.glass.length; i++) if (L.glass[i]) { const x = i % L.w, y = (i - x) / L.w; if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gyb) gyb = y; }
      if (gx1 > gx0) glassCrack(L, rand, gx0 + (gx1 - gx0) * (0.3 + rand() * 0.4), gy0 + (gyb - gy0) * 0.55, Math.min(10, (gyb - gy0) * 0.5));
    }
    sideLayer = layerCanvas(L);
    sideKey = key;
  }
  const S = CRES;
  const W = Math.ceil(box.w * S), H = Math.ceil(box.h * S);
  if (sideCv.width !== W || sideCv.height !== H) { sideCv.width = W; sideCv.height = H; }
  const g = sideCv.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.setTransform(S, 0, 0, S, -box.x * S, -box.y * S);
  g.imageSmoothingEnabled = false;
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.drawImage(sideLayer, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(sideCv, box.x, box.y, box.w, box.h);
  c.imageSmoothingEnabled = sm;
}

// faíscas de raspão (guard-rail, cerca): riscos saindo do canto do capô do lado raspado
export function drawSparks(c: CanvasRenderingContext2D, t: number, seed: number, side: number, baseX: number, baseY: number) {
  if (t > 0.45) return;
  const rand = rng(seed * 17 + 3);
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + side * (0.5 + rand() * 0.9), sp = 70 + rand() * 130, born = rand() * 0.12, tt = t - born;
    if (tt <= 0 || tt > 0.3) continue;
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, age = tt / 0.3;
    const x = baseX + vx * tt, y = baseY + vy * tt + 240 * tt * tt;
    c.fillStyle = age < 0.35 ? '#fff6c8' : age < 0.7 ? '#ffc23a' : '#ff6a1a';
    c.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (age < 0.6) c.fillRect(Math.round(x - vx / sp), Math.round(y - vy / sp), 1, 1);
  }
}
