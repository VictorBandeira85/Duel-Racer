// Utilidades de desenho da interface (fonte pixelada, painéis, pontilhado)
export const FONT = '"Press Start 2P", monospace';

export function text(
  c: CanvasRenderingContext2D, s: string, x: number, y: number,
  size = 8, color = '#fff', align: CanvasTextAlign = 'left', shadow: string | null = '#000',
) {
  c.font = `${size}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'top';
  if (shadow) {
    c.fillStyle = shadow;
    c.fillText(s, x + 1, y + 1);
  }
  c.fillStyle = color;
  c.fillText(s, x, y);
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
