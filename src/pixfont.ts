// Dígitos de 3x5 pixels, como os números dos mostradores do original
const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ':': ['000', '010', '000', '010', '000'],
  '.': ['000', '000', '000', '000', '010'],
  '/': ['001', '001', '010', '100', '100'],
  P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  D: ['110', '101', '101', '101', '110'],
};

export function pixWidth(s: string, scale = 1) {
  return (s.length * 4 - 1) * scale;
}

// (x, y) = centro do texto
export function pix(c: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, scale = 1) {
  c.fillStyle = color;
  // alinhado à grade do próprio tamanho (meio pixel quando scale = 0.5)
  const g = Math.min(1, scale);
  const snap = (v: number) => Math.round(v / g) * g;
  let px = snap(x - pixWidth(s, scale) / 2);
  const py = snap(y - (5 * scale) / 2);
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (g) {
      for (let r = 0; r < 5; r++)
        for (let k = 0; k < 3; k++) if (g[r][k] === '1') c.fillRect(px + k * scale, py + r * scale, scale, scale);
    }
    px += 4 * scale;
  }
}
