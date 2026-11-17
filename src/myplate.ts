// Placa do carro do jogador: placa cinza brasileira dos anos 90 (três letras e quatro números,
// ABC-1234) com a cidade opcional estampada em cima, como as de verdade. Escolhida nos AJUSTES
// (aba INTERFACE > PLACA); aparece no carro visto de fora (modo foto, replay, fantasma) e vai junto
// no código do fantasma e no ranking da semana.
import type { Plate } from './plates';

const KEY = 'duel-racer:placa';
export interface MyPlate { text: string; city: string } // text = "ABC-1234"; city = "" ou "CAMPINAS-SP"

// cidades oferecidas (a placa cinza trazia o município e a sigla do estado acima dos caracteres)
export const CITIES = [
  '', 'SÃO PAULO-SP', 'CAMPINAS-SP', 'SANTOS-SP', 'RIBEIRÃO PRETO-SP', 'RIO DE JANEIRO-RJ', 'NITERÓI-RJ', 'BELO HORIZONTE-MG',
  'UBERLÂNDIA-MG', 'CURITIBA-PR', 'LONDRINA-PR', 'PORTO ALEGRE-RS', 'CAXIAS DO SUL-RS', 'FLORIANÓPOLIS-SC', 'JOINVILLE-SC',
  'BRASÍLIA-DF', 'GOIÂNIA-GO', 'CAMPO GRANDE-MS', 'CUIABÁ-MT', 'SALVADOR-BA', 'RECIFE-PE', 'FORTALEZA-CE', 'NATAL-RN',
  'JOÃO PESSOA-PB', 'MACEIÓ-AL', 'ARACAJU-SE', 'SÃO LUÍS-MA', 'TERESINA-PI', 'BELÉM-PA', 'MANAUS-AM', 'VITÓRIA-ES',
];
// letras da placa (todas as do alfabeto valiam; I, O e Q também apareciam)
export const PLATE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// confere e normaliza: aceita "abc1234", "ABC 1234", "ABC-1234"; null se não for 3 letras + 4 números
export function parsePlate(s: string): string | null {
  const m = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s-]/g, '').match(/^([A-Z]{3})(\d{4})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}
export const validCity = (c: string) => CITIES.includes(c);

function randomPlate(): string {
  const L = 'ABCDEFGHJKLMNPRSTUVXZ';
  const r = () => Math.random();
  return `${L[Math.floor(r() * L.length)]}${L[Math.floor(r() * L.length)]}${L[Math.floor(r() * L.length)]}-${String(Math.floor(r() * 10000)).padStart(4, '0')}`;
}
export { randomPlate };

let cache: MyPlate | null = null;
export function myPlate(): MyPlate {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    const text = v && typeof v.text === 'string' ? parsePlate(v.text) : null;
    if (text) return (cache = { text, city: typeof v.city === 'string' && validCity(v.city) ? v.city : '' });
  } catch { /* save estragado: placa nova */ }
  cache = { text: randomPlate(), city: '' };
  setMyPlate(cache.text, '');
  return cache;
}
export function setMyPlate(text: string, city: string) {
  const t = parsePlate(text);
  if (!t) return false;
  cache = { text: t, city: validCity(city) ? city : '' };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch { /* sem armazenamento: vale só nesta sessão */ }
  return true;
}
// a placa para desenhar no carro (plates.ts): cinza, de 1990 em diante
export const myPlateLook = (): Plate => ({ style: 'br', text: myPlate().text, year: 1992 });
// placa de outra pessoa (texto vindo de um código): só se for válida
export const plateLook = (text?: string): Plate | undefined => {
  const t = text ? parsePlate(text) : null;
  return t ? { style: 'br', text: t, year: 1992 } : undefined;
};

// placa grande (editor, ranking, moldura da foto): chapa cinza com a cidade em cima e os caracteres
// pretos em relevo; cursor = índice do caractere destacado (0..6), -1 nenhum
export function drawBigPlate(c: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, city: string, cursor = -1, blink = true) {
  const h = Math.round(w * 0.31);
  c.fillStyle = '#1a1614';
  c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = '#c8cacf';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#e4e6ea';
  c.fillRect(x + 1, y + 1, w - 2, 1);
  c.fillStyle = '#8e9096';
  c.fillRect(x + 1, y + h - 2, w - 2, 1);
  // furos dos parafusos e a borda em relevo
  c.strokeStyle = '#6a6c72';
  c.lineWidth = 1;
  c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  c.fillStyle = '#55575c';
  const bolt = Math.max(1, Math.round(w / 90));
  c.fillRect(x + Math.round(w * 0.12), y + Math.round(h * 0.16), bolt * 2, bolt);
  c.fillRect(x + Math.round(w * 0.88) - bolt * 2, y + Math.round(h * 0.16), bolt * 2, bolt);
  // cidade (faixa de cima)
  const cs = Math.max(4, Math.round(h * 0.16));
  c.font = `${cs}px "Press Start 2P", monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillStyle = '#26262c';
  c.fillText((city || ' ').normalize('NFD').replace(/[̀-ͯ]/g, ''), x + w / 2, y + Math.round(h * 0.1));
  // caracteres: 3 letras, traço, 4 números (fonte da placa: alta e condensada, desenhada em blocos)
  const chars = text.replace('-', '');
  const gh = Math.round(h * 0.52), gw = Math.round(gh * 0.56), gap = Math.max(1, Math.round(gw * 0.22));
  const dash = Math.round(gw * 0.7);
  const total = 7 * gw + 6 * gap + dash + gap;
  let cx = x + Math.round((w - total) / 2);
  const gy = y + Math.round(h * 0.36);
  for (let i = 0; i < 7; i++) {
    if (i === 3) {
      c.fillStyle = '#1a1a1e';
      c.fillRect(cx, gy + Math.round(gh / 2) - Math.max(1, Math.round(gh * 0.06)), dash, Math.max(2, Math.round(gh * 0.12)));
      cx += dash + gap;
    }
    if (i === cursor && blink) {
      c.fillStyle = '#ffd21a';
      c.fillRect(cx - 2, gy - 2, gw + 4, gh + 4);
    }
    glyph(c, chars[i] ?? ' ', cx, gy, gw, gh, '#1a1a1e');
    if (i === cursor) {
      c.fillStyle = '#d01f26';
      c.fillRect(cx - 1, gy + gh + 2, gw + 2, 2);
    }
    cx += gw + gap;
  }
  c.textAlign = 'left';
  return h;
}
// posição de cada caractere (para tocar e escolher)
export function bigPlateCells(x: number, y: number, w: number) {
  const h = Math.round(w * 0.31);
  const gh = Math.round(h * 0.52), gw = Math.round(gh * 0.56), gap = Math.max(1, Math.round(gw * 0.22));
  const dash = Math.round(gw * 0.7);
  const total = 7 * gw + 6 * gap + dash + gap;
  let cx = x + Math.round((w - total) / 2);
  const gy = y + Math.round(h * 0.36);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < 7; i++) {
    if (i === 3) cx += dash + gap;
    out.push({ x: cx, y: gy, w: gw, h: gh });
    cx += gw + gap;
  }
  return out;
}

// letras e números em grade 5x7 (traço grosso, como a fonte das placas cinzas), ampliados
const G: Record<string, string> = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
  3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100',
};
function glyph(c: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number, color: string) {
  const g = G[ch];
  if (!g) return;
  c.fillStyle = color;
  const cw = w / 5, chh = h / 7;
  for (let k = 0; k < 35; k++) {
    if (g[k] !== '1') continue;
    const gx = k % 5, gy = Math.floor(k / 5);
    const x0 = Math.round(x + gx * cw), x1 = Math.round(x + (gx + 1) * cw), y0 = Math.round(y + gy * chh), y1 = Math.round(y + (gy + 1) * chh);
    c.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  }
}
