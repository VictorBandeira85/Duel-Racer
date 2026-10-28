// Converte arte SVG em imagens (sprites) para o canvas do jogo.
// Cada SVG vira uma imagem uma vez; cada tamanho usado é rasterizado e guardado em cache.
// As bordas são endurecidas (sem semitransparência), para manter o visual de pixel art.

const images = new Map<string, HTMLImageElement>();
const rasters = new Map<string, HTMLCanvasElement>();
const MAX_RASTERS = 160;

// aceita o texto de um SVG ou o endereço de uma imagem (PNG gerado de foto)
function image(src: string): HTMLImageElement | null {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.src = src.trimStart().startsWith('<svg') ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src) : src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// proporção altura/largura da imagem (null enquanto carrega)
export function spriteAspect(src: string): number | null {
  const img = image(src);
  return img ? img.naturalHeight / img.naturalWidth : null;
}

// Carrega antecipadamente (para não piscar na primeira vez que aparece)
export function preloadSvg(...svgs: string[]) {
  for (const s of svgs) image(s);
}

// Repintura: cada pixel marcado na máscara recebe a cor nova, mantendo a diferença de
// luminosidade em relação ao tom médio da carroceria (o sombreado continua o mesmo)
const tinted = new Map<string, HTMLCanvasElement>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

export interface Paint { mask: string; color: string }

function paintImage(src: string, paint: Paint): HTMLCanvasElement | null {
  const key = `${src.length}:${src.slice(-40)}:${paint.color}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const img = image(src), mask = image(paint.mask);
  if (!img || !mask) return null;
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  c.drawImage(mask, 0, 0, w, h);
  const m = c.getImageData(0, 0, w, h).data;
  c.clearRect(0, 0, w, h);
  c.drawImage(img, 0, 0);
  const data = c.getImageData(0, 0, w, h);
  const d = data.data;
  // tom médio (mediana da luminosidade) da carroceria original
  const ls: number[] = [];
  for (let i = 0; i < d.length; i += 4) if (m[i] > 127 && d[i + 3]) ls.push(rgbToHsl(d[i], d[i + 1], d[i + 2])[2]);
  ls.sort((a, b) => a - b);
  const base = ls.length ? ls[ls.length >> 1] : 0.5;
  const t = parseInt(paint.color.slice(1), 16);
  const [th, ts, tl] = rgbToHsl(t >> 16, (t >> 8) & 255, t & 255);
  for (let i = 0; i < d.length; i += 4) {
    if (m[i] <= 127 || !d[i + 3]) continue;
    const l = rgbToHsl(d[i], d[i + 1], d[i + 2])[2];
    // proporcional ao tom médio: o que é mais escuro que ele (frisos, vincos, sombra) escurece
    // na mesma proporção na cor nova (num carro preto, a diferença absoluta é mínima e os frisos
    // sumiriam), com expoente para não realçar o chuvisco; o mais claro sobe até o branco
    const nl = l < base ? tl * (l / base) ** 0.6 : tl + ((l - base) * (1 - tl)) / (1 - base);
    const [r, g, b] = hslToRgb(th, ts, Math.min(0.96, Math.max(0.04, nl)));
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  c.putImageData(data, 0, 0);
  tinted.set(key, cv);
  return cv;
}

// Sprite do SVG no tamanho pedido (null enquanto a imagem ainda carrega)
export function svgSprite(svg: string, w: number, h: number, paint?: Paint): HTMLCanvasElement | null {
  const img: CanvasImageSource | null = paint ? paintImage(svg, paint) : image(svg);
  if (!img) return null;
  // tamanhos agrupados de 2 em 2 px para não gerar um sprite por quadro
  const bw = Math.max(2, Math.round(w / 2) * 2), bh = Math.max(2, Math.round(h / 2) * 2);
  const key = `${svg.length}:${svg.slice(-40)}:${bw}x${bh}:${paint?.color ?? ''}`;
  let cv = rasters.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = bw;
  cv.height = bh;
  const c = cv.getContext('2d')!;
  // pixel art: redução por vizinho mais próximo (um pixel da arte por pixel da tela, sem
  // misturar cores); SVG é rasterizado em 4x e reduzido do mesmo jeito, para não ter antialias
  c.imageSmoothingEnabled = false;
  if (!paint && svg.trimStart().startsWith('<svg')) {
    const big = document.createElement('canvas');
    big.width = bw * 4;
    big.height = bh * 4;
    big.getContext('2d')!.drawImage(img, 0, 0, bw * 4, bh * 4);
    c.drawImage(big, 0, 0, bw, bh);
  } else {
    // muito reduzido (carro longe, retrovisor): vizinho mais próximo pularia linhas inteiras e
    // o vidro, os bancos e as lanternas sumiriam (o carro vira um bloco da cor da lataria);
    // aí a redução faz a média dos pixels, e o contorno continua nítido pelo corte do alfa
    const srcW = 'naturalWidth' in img ? (img as HTMLImageElement).naturalWidth : (img as HTMLCanvasElement).width;
    if (srcW > bw * 2.5) {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
    }
    c.drawImage(img, 0, 0, bw, bh);
  }
  const data = c.getImageData(0, 0, bw, bh);
  const d = data.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  c.putImageData(data, 0, 0);
  if (rasters.size >= MAX_RASTERS) rasters.delete(rasters.keys().next().value!);
  rasters.set(key, cv);
  return cv;
}
