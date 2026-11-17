import { need } from './imgprio';

// Arte da obra e da blitz desenhada pelo Victor (src/assets/obra, recortada por tools/ref/magenta_cut.py e
// tools/ref/flagger_poses.py, acabada por tools/ref/obra_art.py): cone, barril, cavalete, montes, as
// máquinas, o semáforo, as placas e o sinaleiro. Enquanto a imagem não chega, vale o desenho provisório.
// As luzes que acendem e apagam (pisca do cavalete, giroflex, lentes do semáforo) saem de cópias da
// arte com a lâmpada apagada, feitas uma vez a partir dela (pixel a pixel, só dentro da lente).
const SRC = import.meta.glob('./assets/obra/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const imgs = new Map<string, HTMLImageElement>();

function img(name: string): HTMLImageElement | null {
  const src = SRC[`./assets/obra/${name}.png`];
  if (!src) return null;
  let im = imgs.get(name);
  if (!im) {
    im = new Image();
    im.src = src;
    imgs.set(name, im);
  }
  if (im.complete && im.naturalWidth) return im;
  need(im);
  return null;
}
export const preloadObra = () => Object.keys(SRC).forEach((p) => img(p.slice(14, -4)));
// todas carregadas? (a tela de carregamento do trecho espera)
export function obraReady() {
  let ok = true;
  for (const p of Object.keys(SRC)) if (!img(p.slice(14, -4))) ok = false;
  return ok;
}

// lentes (caixa em pixels da arte) e como apagar: 'amber' só escurece os pixels cor de lâmpada (a cúpula
// fica marrom-alaranjada fosca); 'lens' escurece a cor da lente inteira (vidro apagado do semáforo)
type Lens = [x0: number, y0: number, x1: number, y1: number, mode: 'amber' | 'lens'];
const OFF: Record<string, Lens[]> = {
  'horse:off': [[106, 0, 130, 21, 'amber']],
  'roller:off': [[74, 0, 93, 13, 'amber']],
  'backhoe:off': [[50, 17, 76, 34, 'amber']],
  'signal:red': [[18, 62, 54, 95, 'lens']], // PARE: o verde apagado
  'signal:green': [[18, 16, 55, 49, 'lens']], // SIGA: o vermelho apagado
};
const variants = new Map<string, HTMLCanvasElement | HTMLImageElement>();
function variant(im: HTMLImageElement, key: string) {
  let v = variants.get(key);
  if (v) return v;
  try {
    const cv = document.createElement('canvas');
    cv.width = im.naturalWidth;
    cv.height = im.naturalHeight;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height);
    const p = d.data;
    for (const [x0, y0, x1, y1, mode] of OFF[key]) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * cv.width + x) * 4;
          if (!p[i + 3]) continue;
          const r = p[i], gg = p[i + 1], b = p[i + 2];
          if (mode === 'amber') {
            if (r < 140 || r < b + 70) continue; // só a cúpula (aro de metal e contorno ficam)
            p[i] = r * 0.42; p[i + 1] = gg * 0.3; p[i + 2] = b * 0.25 + 4;
          } else {
            if (Math.max(r, gg, b) - Math.min(r, gg, b) < 40) continue; // caixa preta e metal em volta da lente
            const l = (r + gg + b) / 3;
            p[i] = (r * 0.5 + l * 0.5) * 0.3; p[i + 1] = (gg * 0.5 + l * 0.5) * 0.3; p[i + 2] = (b * 0.5 + l * 0.5) * 0.3 + 3;
          }
        }
      }
    }
    g.putImageData(d, 0, 0);
    v = cv;
  } catch {
    v = im; // (canvas sujo: fica a arte como veio)
  }
  variants.set(key, v);
  return v;
}

// a arte (ou a cópia com a luz apagada: 'horse:off', 'signal:red'...) ou null enquanto carrega
export function obraArt(key: string): HTMLImageElement | HTMLCanvasElement | null {
  const [name] = key.split(':');
  const im = img(name);
  if (!im) return null;
  return key in OFF ? variant(im, key) : im;
}
export const hasObraArt = (key: string) => !!obraArt(key);

// desenha a arte com a base centrada em (x, y), w x h, sem suavizar; flip espelha
export function drawObraArt(c: CanvasRenderingContext2D, src: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w: number, h: number, flip = false) {
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  if (flip) {
    c.save();
    c.translate(x, 0);
    c.scale(-1, 1);
    c.drawImage(src, -w / 2, y - h, w, h);
    c.restore();
  } else c.drawImage(src, x - w / 2, y - h, w, h);
  c.imageSmoothingEnabled = sm;
}

// tamanho de cada arte em pixels (largura, altura), para as proporções no mundo
export const OBRA_PX: Record<string, [number, number]> = {
  cone: [90, 120], barrel: [94, 140], horse: [144, 140], dirt: [258, 120], gravel: [252, 120],
  backhoe: [178, 220], roller: [169, 220], signal: [74, 200], sign: [238, 160],
};

// Sinaleiro (flagm/flagw = homem/mulher de frente, flagm34/flagw34 = em 3/4 olhando para a esquerda da
// imagem; pose 0 bandeira abaixada, 1 erguida, 2 braço esticado para a esquerda). Todas na mesma escala,
// pés na mesma linha: a pessoa (do pé ao alto do capacete) tem 150 px. cx = meio dos pés em cada arte
// (as artes têm larguras diferentes: a bandeira esticada fica fora do corpo).
export const FLAGGER_BODY_PX = 150;
export const FLAGGER_ART: Record<string, { w: number; h: number; cx: number }> = {
  'flagm-0': { w: 74, h: 189, cx: 45 }, 'flagm-1': { w: 72, h: 189, cx: 43.5 }, 'flagm-2': { w: 114, h: 189, cx: 84 },
  'flagm34-0': { w: 78, h: 190, cx: 47.5 }, 'flagm34-1': { w: 76, h: 190, cx: 44 }, 'flagm34-2': { w: 114, h: 190, cx: 82 },
  'flagw-0': { w: 72, h: 188, cx: 44 }, 'flagw-1': { w: 72, h: 188, cx: 44 }, 'flagw-2': { w: 112, h: 188, cx: 84 },
  'flagw34-0': { w: 78, h: 189, cx: 48 }, 'flagw34-1': { w: 74, h: 189, cx: 44 }, 'flagw34-2': { w: 114, h: 189, cx: 83.5 },
};

// Placas da obra e da blitz (238 x 160: chapa nas linhas 0..107, os dois postes embaixo). A chapa sai
// na proporção da arte e os postes crescem até a altura pedida (a placa fica a ~2 m do chão): só o
// trecho liso do meio dos postes (linhas 112..148) é esticado na vertical; o pé fica como na arte.
// Nunca espelhadas (têm letra; a seta do DESVIO aponta para a esquerda, que é o lado do desvio: a obra
// fecha sempre a faixa da direita).
export function drawSignArt(c: CanvasRenderingContext2D, name: 'sign-blitz' | 'sign-obras' | 'sign-desvio', x: number, y: number, w: number, h: number) {
  const im = obraArt(name);
  if (!im) return;
  const s = w / 238, L = x - w / 2, T = y - h;
  const top = 112 * s, foot = 12 * s, mid = Math.max(0, h - top - foot);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(im, 0, 0, 238, 112, L, T, w, top);
  c.drawImage(im, 0, 112, 238, 36, L, T + top, w, mid);
  c.drawImage(im, 0, 148, 238, 12, L, T + top + mid, w, foot);
  c.imageSmoothingEnabled = sm;
}
