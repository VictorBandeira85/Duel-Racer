// Oficina desenhada (arte do Victor, tools/ref/oficina_art.py): o fundo de dia ou de noite atrás do carro nas
// fotos da garagem e da preparação, móveis e ferramentas no chão e o mecânico. Tudo guardado a 84 px por metro;
// cada foto diz quantos px por metro mostra (o tamanho do carro) e onde fica a linha do piso junto da parede.
import { need } from './imgprio';

const ART = import.meta.glob('./assets/oficina/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const imgs: Record<string, HTMLImageElement> = {};
function img(n: string) {
  let im = imgs[n];
  if (!im) {
    im = new Image();
    im.src = ART[`./assets/oficina/${n}.png`];
    imgs[n] = im;
  }
  if (im.complete && im.naturalWidth) return im;
  need(im);
  return null;
}
export const preloadWorkshop = () => ['fundo-dia', 'fundo-noite', 'mech-2', 'compressor', 'guincho', 'motor', 'dinamometro'].forEach(img);

const PXM = 84; // px por metro das imagens
const FLOOR = 285.6; // linha do piso junto da parede no fundo (px da imagem: a faixa amarela)
const night = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

interface Rect { x: number; y: number; w: number; h: number }
// fundo + objetos; ppm = px por metro da foto (comprimento do carro / comprimento real), floorY = linha do piso
export function workshopScene(c: CanvasRenderingContext2D, ph: Rect, ppm: number, floorY: number, variant: 'garage' | 'prep') {
  const k = ppm / PXM;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  const bg = img(night() ? 'fundo-noite' : 'fundo-dia');
  if (bg) {
    // estante, carrinho, bancada e painel de ferramentas atrás do carro (a porta de enrolar fica à direita)
    const x0 = ph.x - 110 * k, y0 = floorY - FLOOR * k;
    c.drawImage(bg, Math.round(x0), Math.round(y0), Math.round(bg.width * k), Math.round(bg.height * k));
  }
  const put = (n: string, x: number, depth = 1) => { // pé do objeto na linha do piso, encostado na parede
    const im = img(n);
    if (!im) return;
    const kk = k * depth, w = im.width * kk, h = im.height * kk;
    c.drawImage(im, Math.round(x - w / 2), Math.round(floorY + 1 - h), Math.round(w), Math.round(h));
  };
  // na preparação a foto é baixa e o carro tapa o chão inteiro: só o fundo; na garagem, o mecânico fazendo joia
  if (variant === 'garage') put('mech-2', ph.x + ph.w - 14, 0.92);
  c.imageSmoothingEnabled = sm;
}
// console do dinamômetro (tela de fósforo verde) para a tela do dinamômetro
export function dynoArt(c: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const im = img('dinamometro');
  if (!im) return;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  const w = (im.width * h) / im.height;
  c.drawImage(im, Math.round(x - w), Math.round(y), Math.round(w), Math.round(h));
  c.imageSmoothingEnabled = sm;
}
