// Fotos da revista (pixel art do Victor, sem marcas reais): Toro LP5 em ensaio, motor, raio-x e
// galeria. Usadas nas capas do menu principal e nas páginas de carregamento.
import type { Rect } from './ui';

const PH = import.meta.glob('./assets/photos/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const ph = (n: string) => PH[`./assets/photos/${n}.png`];

export interface Photo { src: string; kicker: string; kc: string; title: string; sub: string; inside: string[]; focus: number }
export const LP5_PHOTOS: Photo[] = [
  { src: ph('lp5-ensaio'), kicker: 'ENSAIO', kc: '#d01f26', title: 'TORO LP5', sub: 'A cunha que parou o mundo', inside: ['V12 e portas tesoura', 'Quanto custa manter uma', 'O LP5 contra a Fúria F4'], focus: 0 },
  { src: ph('lp5-motor'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'V12 DE 455 CV', sub: 'O coração do Toro LP5 de perto', inside: ['48 válvulas, 6 carburadores', 'Câmbio na frente do motor', 'Acerto dos carburadores'], focus: 0.5 },
  { src: ph('lp5-raiox'), kicker: 'RAIO-X', kc: '#1a1614', title: 'POR DENTRO DO LP5', sub: 'Tubos, couro e doze cilindros', inside: ['Chassi tubular desenhado', 'Onde vai o tanque', 'Peso: 1.490 kg'], focus: 0.45 },
  { src: ph('lp5-galeria'), kicker: 'GALERIA', kc: '#d01f26', title: 'PORTAS PARA O CÉU', sub: 'O LP5 em branco e vermelho', inside: ['As cores da fábrica', 'Asa traseira: vale a pena?', 'Leitores mostram o seu'], focus: 0.62 },
].filter((p) => !!p.src);

const imgs = new Map<string, HTMLImageElement>();
function img(src: string) {
  let im = imgs.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    imgs.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
export const preloadPhotos = () => LP5_PHOTOS.forEach((p) => img(p.src));

// a foto cobre o quadro inteiro (corta em cima e embaixo), com uma aproximação lenta (u: 0..1)
export function drawPhoto(c: CanvasRenderingContext2D, r: Rect, p: Photo, u: number) {
  const im = img(p.src);
  if (!im) return false;
  const z = 1.06 + u * 0.08;
  const w = r.w * z, h = (w * im.naturalHeight) / im.naturalWidth;
  const x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) * p.focus;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  c.drawImage(im, x, y, w, h);
  c.imageSmoothingEnabled = sm;
  return true;
}
