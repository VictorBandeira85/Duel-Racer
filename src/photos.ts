// Fotos da revista (pixel art do Victor, sem marcas reais): Toro LP5 (ensaio, motor, raio-x e
// galeria) e Kaze NX (tools/ref/nx_photos.py). Usadas nas capas do menu principal e nas páginas de carregamento.
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
export const NX_PHOTOS: Photo[] = [
  { src: ph('nx-serra'), kicker: 'ENSAIO', kc: '#d01f26', title: 'KAZE NX NA SERRA', sub: 'O japonês que encara os italianos', inside: ['NX contra a Fúria F4', 'Quanto custa manter', 'Direção leve e precisa'], focus: 0.55 },
  { src: ph('nx-senna'), kicker: 'BASTIDORES', kc: '#1e4fb8', title: 'O NX DO CAMPEÃO', sub: 'O carro de todo dia do tricampeão', inside: ['Ele ajudou a acertar o NX', 'Alumínio e V6 de 274 cv', 'Um dia no autódromo'], focus: 0.2 },
  { src: ph('nx-drift'), kicker: 'TESTE', kc: '#d01f26', title: 'NX DE LADO', sub: 'Motor central e tração traseira', inside: ['Como ele sai de traseira', 'Pneus: quanto duram', 'NX na estrada da praia'], focus: 0.55 },
  { src: ph('nx-raiox'), kicker: 'RAIO-X', kc: '#1a1614', title: 'POR DENTRO DO NX', sub: 'O primeiro esportivo todo de alumínio', inside: ['Chassi e carroceria de alumínio', 'V6 3.0 central transversal', 'Peso: 1.370 kg'], focus: 0.55 },
  { src: ph('nx-lavagem'), kicker: 'CUIDADOS', kc: '#1a6a2a', title: 'BANHO DE LOJA', sub: 'Como deixar o NX brilhando', inside: ['Lavar sem riscar', 'Cera de carnaúba', 'Faróis escamoteáveis'], focus: 0.3 },
  { src: ph('nx-prata'), kicker: 'GALERIA', kc: '#d01f26', title: 'NX EM PRATA', sub: 'A cor mais pedida no Japão', inside: ['As cores da fábrica', 'Teto preto de série', 'Rodas de 15 e 16'], focus: 0.6 },
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
export const preloadPhotos = () => [...LP5_PHOTOS, ...NX_PHOTOS].forEach((p) => img(p.src));

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
