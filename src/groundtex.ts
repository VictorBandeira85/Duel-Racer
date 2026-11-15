// Chão com textura em pixel art presa ao mundo (asfalto, grama, areia, neve, terra, cascalho do
// acostamento): cada faixa fina da tela pega a linha da textura que corresponde à distância real
// daquele ponto da estrada (em perspectiva), então a textura rola junto com a pista em vez de
// "ferver" no lugar. Mipmaps (a textura reduzida pela média) são escolhidos pela distância: ao longe
// os detalhes viram a cor média, sem pixels soltos piscando no horizonte.
// No modo econômico (lowFx) o chão continua com as faixas chapadas de antes (render3d.ts).

export const TEX = 16; // unidades do mundo por texel (CAR_W ≈ 1100: um carro tem ~70 texels de largura)
const TH = 128; // altura da textura (texels, na direção da estrada): repete a cada 2048 unidades
const LEVELS = 5;

type Kind = 'grass' | 'sand' | 'snow' | 'dirt' | 'gravel' | 'asphalt';
export interface GroundTex { pats: CanvasPattern[]; w: number }
const cache = new Map<string, GroundTex>();

const rgbOf = (col: string) => (col.startsWith('#') ? [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16)) : (col.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number));
const shade = ([r, g, b]: number[], k: number) => `rgb(${Math.max(0, Math.min(255, Math.round(r * k)))},${Math.max(0, Math.min(255, Math.round(g * k)))},${Math.max(0, Math.min(255, Math.round(b * k)))})`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

export function kindOf(a: string): Kind {
  const [r, g, b] = rgbOf(a);
  if (g > r * 1.12 && g > b) return 'grass';
  if (r + g + b > 600) return 'snow';
  if (r > g && g > b && r - b > 50) return 'sand';
  return 'dirt';
}

function paint(kind: Kind, a: string, b: string, W: number, H: number, lanes: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  let seed = W * 131 + kind.length * 977 + 17;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const A = rgbOf(a), B = rgbOf(b);
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(((Math.round(x) % W) + W) % W, ((Math.round(y) % H) + H) % H, w, h);
  };
  if (kind === 'asphalt' || kind === 'gravel') {
    g.fillStyle = shade(A, 1);
    g.fillRect(0, 0, W, H);
    // granulado fino em grãos de 2 texels (nunca 1 isolado), em 3 tons
    const n = Math.round(W * H * (kind === 'gravel' ? 0.16 : 0.1));
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H, t = rnd();
      const col = t < 0.45 ? shade(A, 0.86) : t < 0.8 ? shade(A, 1.1) : shade(A, kind === 'gravel' ? 1.22 : 0.78);
      if (rnd() < 0.5) px(x, y, 2, 1, col);
      else px(x, y, 1, 2, col);
    }
    if (kind === 'asphalt') {
      // marcas de pneu: duas trilhas mais escuras e lisas em cada faixa de rodagem
      const lw = W / lanes;
      for (let l = 0; l < lanes; l++) for (const off of [0.28, 0.72]) {
        const cx = lw * (l + off);
        g.fillStyle = 'rgba(0,0,0,0.10)';
        g.fillRect(Math.round(cx - 3), 0, 6, H);
        g.fillStyle = 'rgba(0,0,0,0.06)';
        g.fillRect(Math.round(cx - 5), 0, 10, H);
      }
      // remendos raros (retângulos um pouco mais escuros) e trincas finas
      for (let i = 0; i < 2; i++) {
        const x = rnd() * (W - 20), y = rnd() * (H - 14);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(Math.round(x), Math.round(y), 10 + Math.round(rnd() * 10), 6 + Math.round(rnd() * 8));
      }
      for (let i = 0; i < 3; i++) {
        let x = rnd() * W, y = rnd() * H;
        const len = 8 + rnd() * 14;
        for (let k = 0; k < len; k++) {
          px(x, y, 1, 1, shade(A, 0.62));
          x += rnd() < 0.5 ? 1 : 0;
          y += rnd() < 0.7 ? 1 : 0;
        }
      }
    }
    return cv;
  }
  // chão: base pontilhada nas duas cores do tema (como antes), com o detalhe próprio por cima
  g.fillStyle = shade(A, 1);
  g.fillRect(0, 0, W, H);
  g.fillStyle = shade(B, 1);
  for (let y = 0; y < H; y += 2) for (let x = (y >> 1) & 1 ? 2 : 0; x < W; x += 4) g.fillRect(x, y, 2, 2);
  const M = mix(A, B, 0.5);
  if (kind === 'grass') {
    // tufos de capim: um "v" de 3 texels escuro com a ponta clara
    for (let i = 0; i < (W * H) / 26; i++) {
      const x = rnd() * W, y = rnd() * H;
      const dark = shade(M, 0.74), light = shade(M, 1.22);
      px(x, y + 1, 1, 2, dark);
      px(x + 2, y + 1, 1, 2, dark);
      px(x + 1, y, 1, 3, dark);
      px(x + 1, y, 1, 1, light);
    }
    // folhas soltas mais claras, em pares
    for (let i = 0; i < (W * H) / 90; i++) px(rnd() * W, rnd() * H, 2, 1, shade(M, 1.14));
  } else if (kind === 'sand') {
    // ondulações: linhas onduladas mais escuras, com o brilho logo acima
    for (let y0 = 3; y0 < H; y0 += 9) {
      const ph = rnd() * 6.28, amp = 1 + rnd();
      for (let x = 0; x < W; x++) {
        const y = y0 + Math.round(Math.sin(x / 7 + ph) * amp);
        px(x, y, 1, 1, shade(M, 0.86));
        px(x, y - 1, 1, 1, shade(M, 1.08));
      }
    }
    for (let i = 0; i < (W * H) / 60; i++) px(rnd() * W, rnd() * H, 2, 1, shade(M, 0.9));
  } else if (kind === 'snow') {
    // neve: montinhos com sombra azulada e brilhos (pares de texels claros)
    for (let i = 0; i < (W * H) / 70; i++) {
      const x = rnd() * W, y = rnd() * H;
      px(x, y + 2, 5, 1, 'rgba(90,120,170,0.18)');
      px(x + 1, y + 1, 3, 1, 'rgba(90,120,170,0.1)');
    }
    for (let i = 0; i < (W * H) / 110; i++) px(rnd() * W, rnd() * H, 2, 1, 'rgba(255,255,255,0.9)');
  } else {
    // terra: torrões e pedrinhas em 3 tons
    for (let i = 0; i < (W * H) / 30; i++) {
      const t = rnd();
      px(rnd() * W, rnd() * H, 2, 1 + (t < 0.3 ? 1 : 0), t < 0.5 ? shade(M, 0.82) : shade(M, 1.12));
    }
  }
  return cv;
}

// mipmaps pela média (o navegador reduz pela metade com suavização: média de 2x2)
function mips(base: HTMLCanvasElement): HTMLCanvasElement[] {
  const out = [base];
  for (let l = 1; l < LEVELS; l++) {
    const p = out[l - 1];
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, p.width >> 1);
    cv.height = Math.max(1, p.height >> 1);
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(p, 0, 0, cv.width, cv.height);
    out.push(cv);
  }
  return out;
}

export function groundTex(c: CanvasRenderingContext2D, kind: Kind, a: string, b: string, width = 128, lanes = 2): GroundTex {
  const key = `${kind}|${a}|${b}|${width}|${lanes}`;
  let t = cache.get(key);
  if (!t) {
    const lv = mips(paint(kind, a, b, width, TH, lanes));
    t = { pats: lv.map((cv) => c.createPattern(cv, 'repeat')!), w: width };
    cache.set(key, t);
  }
  return t;
}

const M = new DOMMatrix();
// pinta uma fatia da tela (de yA, longe, profundidade zA, até yB, perto, zB) com a textura esticada
// entre as duas profundidades; x0: onde fica o texel 0 na tela; sx: largura do texel (nível 0)
export function texSlice(c: CanvasRenderingContext2D, t: GroundTex, level: number, x0: number, sx: number, zA: number, zB: number, yA: number, yB: number, shape: () => void) {
  const L = Math.max(0, Math.min(LEVELS - 1, level));
  const k = 1 << L;
  const vA = zA / (TEX * k), vB = zB / (TEX * k);
  const dv = vA - vB;
  if (dv <= 1e-6) return;
  // a textura repete a cada TH texels: tira as voltas inteiras para não perder precisão
  const per = TH / k, base = Math.floor(vB / per) * per;
  M.a = sx * k;
  M.b = 0;
  M.c = 0;
  M.d = -(yB - yA) / dv;
  M.e = x0;
  M.f = yB + (vB - base) * (yB - yA) / dv;
  const p = t.pats[L];
  p.setTransform(M);
  c.fillStyle = p;
  c.beginPath();
  shape();
  c.fill();
}
