// Placas dos carros, desenhadas por cima da traseira na hora da corrida.
// Brasil: cinza (de 1990 em diante, três letras) ou amarela (antes de 1990, duas letras); a
// primeira letra é a da região (como as faixas de letras por estado) e a tira de cima tem a cor
// da região. Fora do Brasil, a placa do país de origem do carro: Itália, Alemanha, EUA e Japão.
import type { ThemeId } from './themes';

export type PlateStyle = 'br' | 'brOld' | 'it' | 'de' | 'us' | 'jp';
export interface Plate { style: PlateStyle; text: string; tag?: string }

// regiões da carreira: letra e cor da tira de cima
export const REGION_PLATE: Record<string, { letter: string; tag: string }> = {
  costa: { letter: 'C', tag: '#2a6fdb' },
  vale: { letter: 'V', tag: '#3d9b47' },
  tropico: { letter: 'T', tag: '#e08a20' },
  deserto: { letter: 'D', tag: '#c9a227' },
  metropole: { letter: 'M', tag: '#6a6a7a' },
  fronteira: { letter: 'F', tag: '#8a2a2a' },
  cume: { letter: 'G', tag: '#7ab0d8' },
};
// cada cenário pertence a uma região (no Arcade também)
const THEME_REGION: Record<ThemeId, string> = {
  coast: 'costa', beach: 'costa', farm: 'vale', forest: 'vale', savanna: 'tropico', jungle: 'tropico', canyon: 'tropico',
  desert: 'deserto', city: 'metropole', industrial: 'metropole', autumn: 'fronteira', alpine: 'fronteira', alpinesnow: 'fronteira',
  mountain: 'cume', snow: 'cume',
};
export const themeRegion = (t: ThemeId) => THEME_REGION[t] ?? 'costa';

// país de origem pela arte do carro (os nacionais são 'br')
const ART_COUNTRY: Record<string, PlateStyle> = {
  f40: 'it', testarossa: 'it', diablo: 'it', countach: 'it', patrolsv: 'it', '959': 'de', zr1: 'us', viper: 'us', patrol: 'us', nsx: 'jp',
};
const ART_PROVINCE: Record<string, string> = { f40: 'MO', testarossa: 'MO', diablo: 'BO', countach: 'BO', patrolsv: 'RM' };

const LETTERS = 'ABCDEFGHJKLMNPRSTUVXZ';
const pick = (r: () => number, s: string) => s[Math.floor(r() * s.length)];
const digits = (r: () => number, n: number) => Array.from({ length: n }, () => String(Math.floor(r() * 10))).join('');

// placa de um carro: art = chave da arte (undefined = trânsito genérico, nacional), year = ano do modelo
export function makePlate(r: () => number, region: string, art?: string, year = 1992): Plate {
  const country = (art && ART_COUNTRY[art]) || 'br';
  if (country === 'br') {
    const reg = REGION_PLATE[region] ?? REGION_PLATE.costa;
    if (year < 1990) return { style: 'brOld', text: `${reg.letter}${pick(r, LETTERS)}-${digits(r, 4)}`, tag: reg.tag };
    return { style: 'br', text: `${reg.letter}${pick(r, LETTERS)}${pick(r, LETTERS)}-${digits(r, 4)}`, tag: reg.tag };
  }
  if (country === 'it') return { style: 'it', text: `${ART_PROVINCE[art!] ?? 'MI'} ${digits(r, 1)}${pick(r, LETTERS)}${digits(r, 3)}` };
  if (country === 'de') return { style: 'de', text: `S-${pick(r, LETTERS)}${pick(r, LETTERS)} ${digits(r, 3)}` };
  if (country === 'us') return { style: 'us', text: `${digits(r, 1)}${pick(r, LETTERS)}${pick(r, LETTERS)}${pick(r, LETTERS)}${digits(r, 3)}` };
  return { style: 'jp', text: `${digits(r, 2)}-${digits(r, 2)}` };
}
// ano do modelo pela ficha ("... (1989)")
export const modelYear = (basedOn: string) => Number(basedOn.match(/\((\d{4})\)/)?.[1] ?? 1992);

// fonte 3x5
const F: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', J: '001001001101010', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '111101101101101', P: '110101110100100', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', X: '101101010101101',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111',
  9: '111101111001111', '-': '000000111000000',
};
const LOOK: Record<PlateStyle, { bg: string; ink: string; edge: string; strip?: string }> = {
  br: { bg: '#c8cacf', ink: '#222228', edge: '#1a1a1e' },
  brOld: { bg: '#e8c020', ink: '#1c1a10', edge: '#1a1a1e' },
  it: { bg: '#eef0ea', ink: '#141418', edge: '#2a2a2e' },
  de: { bg: '#f2f2ee', ink: '#141418', edge: '#141418' },
  us: { bg: '#f4f4f0', ink: '#1a2a6a', edge: '#3a3a40', strip: '#c81e24' },
  jp: { bg: '#f2f4ee', ink: '#1f6a38', edge: '#3a3a40', strip: '#1f6a38' },
};

// desenho da placa em pixels (uma vez por placa): moldura, tira de cima e os caracteres centrados
const cache = new Map<string, HTMLCanvasElement>();
function plateCanvas(p: Plate) {
  const key = `${p.style}|${p.text}|${p.tag ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const L = LOOK[p.style];
  const w = p.text.length * 4 + 3, h = 10;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = L.edge;
  g.fillRect(0, 0, w, h);
  g.fillStyle = L.bg;
  g.fillRect(1, 1, w - 2, h - 2);
  // tira de cima: cor da região (Brasil), nome do estado (EUA/Japão: traço colorido)
  const strip = p.tag ?? L.strip;
  if (strip) {
    g.fillStyle = strip;
    for (let x = Math.floor(w / 2) - 5; x < Math.floor(w / 2) + 5; x += 2) g.fillRect(x, 2, 1, 1);
  }
  // Itália: sigla da província em laranja-avermelhado; Alemanha: o hífen vira o selo redondo
  let x = Math.floor((w - (p.text.length * 4 - 1)) / 2);
  for (let i = 0; i < p.text.length; i++) {
    const ch = p.text[i];
    const glyph = F[ch];
    g.fillStyle = p.style === 'it' && i < 2 ? '#c84a1a' : L.ink;
    if (p.style === 'de' && ch === '-') {
      g.fillStyle = '#3a6a3a';
      g.fillRect(x + 1, 5, 1, 2);
    } else if (glyph) {
      for (let k = 0; k < 15; k++) if (glyph[k] === '1') g.fillRect(x + (k % 3), 4 + Math.floor(k / 3), 1, 1);
    }
    x += 4;
  }
  cache.set(key, cv);
  return cv;
}

// placa no retângulo box (frações do sprite) do carro desenhado em (L, T, w, h)
export function drawPlate(c: CanvasRenderingContext2D, L: number, T: number, w: number, h: number, box: number[], p: Plate) {
  const bw = (box[2] - box[0]) * w, bh = (box[3] - box[1]) * h;
  if (bw < 6) return; // longe: a placa da arte basta
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(plateCanvas(p), Math.round(L + box[0] * w), Math.round(T + box[1] * h), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh)));
  c.imageSmoothingEnabled = prev;
}
