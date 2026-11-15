// Motoristas dentro dos carros do trânsito e do rival (folhas do Victor: tools/ref/drivers.py).
// O vidro de cada sprite de trás/frente foi medido em tools/ref/driver_glass.py (assets/people/glass.json:
// trechos por linha e o lugar do motorista). O motorista é composto uma vez por (arte, cor, motorista) na
// resolução da arte, recortado pelo vidro e tingido por ele; svgSprite guarda o resultado em cada tamanho
// junto do cache do próprio sprite (nada é composto por quadro).
import GLASS from './assets/people/glass.json';
import META from './assets/people/drivers.json';
import { imageReady, loadedImage } from './svgsprites';

export type DriverId = 'rival' | 'man' | 'woman' | 'old' | 'young';
type View = 'back' | 'front' | 'side';
// s: vidro (y, x0, x1); d: meio da cabeça, topo, largura da cabeça; g: cor do vidro; t: tom do interior;
// p: banco da arte na frente do motorista (de trás); c: última linha do motorista; o: conversível
interface Glass { s: number[][]; d: number[]; g?: number[]; t?: number[]; p?: number[][]; c?: number; o?: number }

const ART = import.meta.glob('./assets/people/drv-*.png', { eager: true, import: 'default' }) as Record<string, string>;
const drvPng = (id: DriverId, view: View) => ART[`./assets/people/drv-${id}-${view}.png`];
export const DRIVER_IMAGES = Object.values(ART);

// endereço da arte -> nome do sprite no glass.json (traffic/sedan-rear, cars/diablo-front, ...)
const SPRITES = {
  ...import.meta.glob('./assets/traffic/*.png', { eager: true, import: 'default' }),
  ...import.meta.glob('./assets/cars/*.png', { eager: true, import: 'default' }),
} as Record<string, string>;
const KEY = new Map<string, string>();
for (const [p, url] of Object.entries(SPRITES)) KEY.set(url, p.slice('./assets/'.length, -4));
const glassOf = (url: string) => (GLASS as Record<string, Glass>)[KEY.get(url) ?? ''];

const viewOf = (key: string): View => (key.includes('-front') ? 'front' : key.includes('-side') ? 'side' : 'back');

export const REF_HEAD = 22; // largura da cabeça na folha (px nativos): o lugar no glass.json é por ela

// motorista desta arte pronto para entrar? (sem vidro medido, ou a folha ainda carregando: sem motorista)
export function driverFor(url: string | undefined, id: DriverId | undefined): string | undefined {
  if (!url || !id || !glassOf(url)) return undefined;
  const v = viewOf(KEY.get(url)!);
  const src = drvPng(id, v);
  return src && imageReady(src) ? id : undefined;
}

// sorteio fixo por carro do trânsito (pela cor e modelo, que já são do carro): o senhor de chapéu
// prefere fusca, picape, caminhão e kombi
const RUSTIC = new Set(['fusca', 'pickup', 'truck', 'kombi', 'kenworth', 'f4000', 'cargo', 'mb1113', 'vw790', 'volvon10']);
export function trafficDriver(model: string, color: string): DriverId {
  let h = 2166136261;
  for (const ch of model + color) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = ((h >>> 0) % 1000) / 1000;
  const w: [DriverId, number][] = RUSTIC.has(model) ? [['old', 0.5], ['man', 0.25], ['young', 0.15], ['woman', 0.1]] : [['man', 0.35], ['woman', 0.3], ['young', 0.25], ['old', 0.1]];
  let acc = 0;
  for (const [id, p] of w) if (r < (acc += p)) return id;
  return 'man';
}

const masks = new Map<string, Uint8Array>();
function maskOf(key: string, g: Glass, w: number, h: number) {
  let m = masks.get(key);
  if (!m) {
    m = new Uint8Array(w * h);
    for (const [y, x0, x1] of g.s) if (y < h) m.fill(1, y * w + Math.max(0, x0), y * w + Math.min(w, x1));
    masks.set(key, m);
  }
  return m;
}

const cache = new Map<string, HTMLCanvasElement>();
let tmp: HTMLCanvasElement | null = null;

// a arte (img, já repintada) com o motorista atrás do vidro, na resolução da arte
// night: só a silhueta escura contra o vidro (à noite não se vê quem está dentro)
export function withDriver(url: string, img: CanvasImageSource, id: string, tag: string, night = false): CanvasImageSource {
  const g = glassOf(url);
  const key = KEY.get(url)!;
  const ck = `${key}|${tag}|${id}${night ? 'n' : ''}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const view = viewOf(key);
  const dimg = loadedImage(drvPng(id as DriverId, view));
  if (!g || !dimg) return img;
  const W = 'naturalWidth' in img ? (img as HTMLImageElement).naturalWidth : (img as HTMLCanvasElement).width;
  const H = 'naturalHeight' in img ? (img as HTMLImageElement).naturalHeight : (img as HTMLCanvasElement).height;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  try {
    const data = c.getImageData(0, 0, W, H), d = data.data;
    const m = maskOf(key, g, W, H);
    // motorista na escala do carro, o meio da cabeça no lugar medido
    const meta = (META as Record<string, number[]>)[`${id}-${view}`];
    const [cx, top, hw] = g.d;
    const s = hw / REF_HEAD;
    const nw = Math.max(1, Math.round(meta[0] * s)), nh = Math.max(1, Math.round(meta[1] * s));
    if (!tmp) tmp = document.createElement('canvas');
    tmp.width = nw;
    tmp.height = nh;
    const t = tmp.getContext('2d', { willReadFrequently: true })!;
    t.imageSmoothingEnabled = s < 1;
    t.imageSmoothingQuality = 'high';
    t.drawImage(dimg, 0, 0, nw, nh);
    const p = t.getImageData(0, 0, nw, nh).data;
    const ox = Math.round(cx - meta[2] * s), oy = Math.round(top);
    const G = g.g ?? [60, 70, 90], T = g.t ?? [36, 42, 54];
    const gL = G[0] * 0.3 + G[1] * 0.59 + G[2] * 0.11;
    const pm = g.p ? maskOf(key + '|p', { s: g.p, d: g.d }, W, H) : null;
    const clip = g.c ?? 1e9;
    const cut = view === 'side' && meta[9] ? meta[9] * s : 1e9; // lateral: o banco da folha sai (fica o da arte)
    for (let y = 0; y < nh; y++) {
      const Y = oy + y;
      if (Y < 0 || Y >= H || Y > clip) continue;
      for (let x = 0; x < nw; x++) {
        const X = ox + x;
        if (x >= cut || X < 0 || X >= W || !m[Y * W + X] || (pm && pm[Y * W + X])) continue;
        const q = (y * nw + x) * 4;
        if (p[q + 3] < 128) continue;
        const k = (Y * W + X) * 4;
        if (g.o) { // conversível: a cabeça no ar, acima do encosto (sem vidro)
          d[k] = p[q] * 0.85; d[k + 1] = p[q + 1] * 0.85; d[k + 2] = p[q + 2] * 0.85; d[k + 3] = 255;
          continue;
        }
        tint(d, k, p[q], p[q + 1], p[q + 2], T, gL, night);
      }
    }
    c.putImageData(data, 0, 0);
  } catch {
    return img; // sem leitura de pixels: o carro sai sem motorista
  }
  cache.set(ck, cv);
  if (cache.size > 240) cache.delete(cache.keys().next().value!);
  return cv;
}

// atrás do vidro: o motorista no tom do interior visto pelo vidro (T, o dos bancos escuros da arte), quase
// sem cor própria, com o desenho dele em claro/escuro; o brilho/reflexo do vidro da arte (o que está mais
// claro que o vidro, gL) continua por cima. Igual a shade() em tools/ref/driver_glass.py
function tint(d: Uint8ClampedArray, k: number, r: number, g: number, b: number, T: number[], gL: number, night: boolean) {
  const L = r * 0.3 + g * 0.59 + b * 0.11;
  const ref = Math.max(0, d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11 - gL - 25) * 0.8;
  if (night) { // silhueta: o tom do interior, mais escuro, quase sem o desenho da pessoa
    const n = 0.45 + 0.25 * (L / 255);
    d[k] = T[0] * n + ref; d[k + 1] = T[1] * n + ref; d[k + 2] = T[2] * n + ref;
    return;
  }
  const f = (v: number, t: number) => t * (0.55 + (1.7 * (L + (v - L) * 0.35)) / 255) + ref;
  d[k] = f(r, T[0]);
  d[k + 1] = f(g, T[1]);
  d[k + 2] = f(b, T[2]);
}
