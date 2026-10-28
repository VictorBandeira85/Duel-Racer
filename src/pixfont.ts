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
  ',': ['000', '000', '000', '010', '100'],
  '/': ['001', '001', '010', '100', '100'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
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

// Dígitos de 5x7 em meio pixel: tamanho entre o 3x5 inteiro e o 3x5 em meio pixel
const GLYPHS7: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

export function pix7Width(s: string, bold = false) {
  return (s.length * (bold ? 7 : 6) - 1) * 0.5;
}

// (x, y) = centro do texto, em meio pixel
// bold: cada ponto ganha o vizinho da direita (traço mais grosso, como os números da arte)
export function pix7(c: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, bold = false) {
  c.fillStyle = color;
  const bw = bold ? 1 : 0.5;
  let px = Math.round((x - pix7Width(s) / 2) * 2) / 2;
  const py = Math.round((y - 1.75) * 2) / 2;
  for (const ch of s) {
    const g = GLYPHS7[ch];
    if (g) for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r][k] === '1') c.fillRect(px + k * 0.5, py + r * 0.5, bw, 0.5);
    px += bold ? 3.5 : 3;
  }
}
