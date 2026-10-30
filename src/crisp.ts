// Pixel art nítida a partir de desenho vetorial: o desenho é feito em 4x e reduzido
// pegando um pixel por bloco (sem misturar cores), a transparência vira 0/1 e ganha um
// contorno escuro de 1 pixel, como na arte dos carros. Cada tamanho fica em cache.

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

export interface Crisp {
  cv: HTMLCanvasElement; // tamanho w+2 x h+2 (1 px de contorno em volta)
  w: number;
  h: number;
}

const cache = new Map<string, Crisp>();
const MAX = 400;
let work: HTMLCanvasElement | null = null;

// tamanhos agrupados: pequenos de 1 em 1 px, médios de 2 em 2, grandes de 4 em 4 (menos redesenhos
// enquanto o objeto cresce na tela; a ampliação final cobre a diferença)
const bucket = (v: number) => (v <= 48 ? Math.max(1, Math.round(v)) : v <= 120 ? Math.round(v / 2) * 2 : Math.round(v / 4) * 4);

export function crisp(key: string, w: number, h: number, draw: Draw): Crisp {
  const bw = bucket(w), bh = bucket(h);
  const k = `${key}:${bw}x${bh}`;
  const hit = cache.get(k);
  if (hit) {
    cache.delete(k); // LRU: volta para o fim
    cache.set(k, hit);
    return hit;
  }
  const S = bw * bh > 30000 ? 2 : 4;
  if (!work) work = document.createElement('canvas');
  if (work.width < bw * S || work.height < bh * S) {
    work.width = Math.max(work.width, bw * S);
    work.height = Math.max(work.height, bh * S);
  }
  const wc = work.getContext('2d')!;
  wc.setTransform(1, 0, 0, 1, 0, 0);
  wc.clearRect(0, 0, bw * S, bh * S);
  wc.setTransform(S, 0, 0, S, 0, 0);
  draw(wc, bw, bh);

  const cv = document.createElement('canvas');
  cv.width = bw + 2;
  cv.height = bh + 2;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(work, 0, 0, bw * S, bh * S, 1, 1, bw, bh);
  const W = bw + 2, H = bh + 2;
  const img = c.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  // contorno: pixel vazio encostado em pixel cheio recebe a cor do vizinho bem escurecida
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3]) continue;
      let n = -1;
      if (x > 0 && src[i - 1]) n = i - 4;
      else if (x < W - 1 && src[i + 7]) n = i + 4;
      else if (y > 0 && src[i - W * 4 + 3]) n = i - W * 4;
      else if (y < H - 1 && src[i + W * 4 + 3]) n = i + W * 4;
      if (n < 0) continue;
      d[i] = src[n] * 0.22;
      d[i + 1] = src[n + 1] * 0.22;
      d[i + 2] = src[n + 2] * 0.22 + 6;
      d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  const out = { cv, w: bw, h: bh };
  if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
  cache.set(k, out);
  return out;
}

// Desenha um sprite nítido com a base centrada em (x, y), no tamanho w x h da tela.
// Acima de `ref` px de altura, usa o desenho de `ref` px ampliado (pixels grandes, como no SNES).
export function drawCrisp(
  c: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, draw: Draw, ref = 96,
) {
  if (w < 1 || h < 1) return;
  // rasterizado no dobro da resolução nativa: objetos da beira da pista mais definidos
  const Q = 2;
  const k = h > ref ? ref / h : 1;
  const s = crisp(key, w * k * Q, h * k * Q, draw);
  const sx = w / s.w, sy = h / s.h;
  c.drawImage(s.cv, Math.round(x - w / 2 - sx), Math.round(y - h - sy), Math.round(s.cv.width * sx), Math.round(s.cv.height * sy));
}
