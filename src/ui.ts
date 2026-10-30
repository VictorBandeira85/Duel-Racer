// Utilidades de desenho da interface (fonte pixelada, painéis, pontilhado)
export const FONT = '"Press Start 2P", monospace';

// símbolos que a fonte de pixel não tem (o navegador os desenharia com outra fonte, pequenos
// e borrados): trocados por equivalentes que ela tem
const GLYPH_FIX: Record<string, string> = { '◀': '<', '▶': '>', '▲': '^', '▼': 'v', '•': '·', '✓': '', '—': '-', '−': '-', '→': '>', '×': 'x', '≈': '~', '★': '*' };
export const fixGlyphs = (s: string) => s.replace(/[◀▶▲▼•✓—−→×≈★]/g, (ch) => GLYPH_FIX[ch] ?? ch).trimEnd();

// maiúsculas acentuadas: a fonte de pixel as desenha com corpo de minúscula ("MúSICA"); a letra
// sai como maiúscula normal e o acento é desenhado por cima, nos pixels da fonte (8 por letra)
const ACCENT: Record<string, [string, number[][]]> = (() => {
  const acute = [[4, -3], [5, -3], [3, -2], [4, -2]], grave = [[2, -3], [3, -3], [3, -2], [4, -2]];
  const circ = [[3, -3], [4, -3], [2, -2], [5, -2]], tilde = [[1, -2], [2, -3], [3, -3], [4, -2], [5, -2], [6, -3]];
  return {
    Á: ['A', acute], À: ['A', grave], Â: ['A', circ], Ã: ['A', tilde], É: ['E', acute], Ê: ['E', circ], Í: ['I', acute],
    Ó: ['O', acute], Ô: ['O', circ], Õ: ['O', tilde], Ú: ['U', acute], Ç: ['C', [[3, 7], [4, 7], [4, 8], [2, 9], [3, 9]]],
  };
})();
const ACCENT_RE = /[ÁÀÂÃÉÊÍÓÔÕÚÇ]/;
function fillTextAccents(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) {
  if (!ACCENT_RE.test(s)) {
    c.fillText(s, x, y);
    return;
  }
  const base = [...s].map((ch) => ACCENT[ch]?.[0] ?? ch).join('');
  c.fillText(base, x, y);
  const u = size / 8, adv = c.measureText('A').width; // fonte monoespaçada
  let px = x;
  for (const ch of s) {
    const acc = ACCENT[ch];
    if (acc) for (const [dx, dy] of acc[1]) c.fillRect(px + dx * u, y + dy * u, u, u);
    px += adv;
  }
}

export function text(
  c: CanvasRenderingContext2D, s: string, x: number, y: number,
  size = 8, color = '#fff', align: CanvasTextAlign = 'left', shadow: string | null = '#000',
) {
  s = fixGlyphs(s);
  c.font = `${size}px ${FONT}`;
  // posição inteira, para a fonte de pixel não sair com antialias
  const tw = align === 'left' ? 0 : c.measureText(s).width;
  x = Math.round(align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x);
  y = Math.round(y);
  c.textAlign = 'left';
  c.textBaseline = 'top';
  if (shadow) {
    c.fillStyle = shadow;
    fillTextAccents(c, s, x + 1, y + 1, size);
  }
  c.fillStyle = color;
  fillTextAccents(c, s, x, y, size);
}

export interface Rect { x: number; y: number; w: number; h: number }
export const inside = (px: number, py: number, r: Rect) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export function panel(c: CanvasRenderingContext2D, r: Rect, fill: string, border: string, light = 'rgba(255,255,255,0.25)') {
  c.fillStyle = border;
  c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  c.fillStyle = fill;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.fillStyle = light;
  c.fillRect(r.x + 2, r.y + 2, r.w - 4, 1);
  c.fillRect(r.x + 2, r.y + 2, 1, r.h - 4);
}

const patterns = new Map<string, CanvasPattern>();
export function dither(c: CanvasRenderingContext2D, a: string, b: string): CanvasPattern {
  const key = a + b;
  let p = patterns.get(key);
  if (!p) {
    const t = document.createElement('canvas');
    t.width = t.height = 2;
    const x = t.getContext('2d')!;
    x.fillStyle = a;
    x.fillRect(0, 0, 2, 2);
    x.fillStyle = b;
    x.fillRect(0, 0, 1, 1);
    x.fillRect(1, 1, 1, 1);
    p = c.createPattern(t, 'repeat')!;
    patterns.set(key, p);
  }
  return p;
}

// Textura pontilhada aleatória (painel, volante, teto), no estilo dos 16 bits
const speckles = new Map<string, CanvasPattern>();
export function speckle(c: CanvasRenderingContext2D, base: string, dots: [string, number][], seed = 1): CanvasPattern {
  const key = base + JSON.stringify(dots) + seed;
  let p = speckles.get(key);
  if (!p) {
    const size = 48;
    const t = document.createElement('canvas');
    t.width = t.height = size;
    const x = t.getContext('2d')!;
    x.fillStyle = base;
    x.fillRect(0, 0, size, size);
    let s = seed * 9301 + 49297;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let yy = 0; yy < size; yy++)
      for (let xx = 0; xx < size; xx++) {
        const r = rand();
        let acc = 0;
        for (const [col, prob] of dots) {
          acc += prob;
          if (r < acc) {
            x.fillStyle = col;
            x.fillRect(xx, yy, 1, 1);
            break;
          }
        }
      }
    p = c.createPattern(t, 'repeat')!;
    speckles.set(key, p);
  }
  return p;
}
