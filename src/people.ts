// Personagens em pixel art desenhados por código: o policial rodoviário (na pista, ao lado da
// viatura) e o frentista do posto. Cada um é desenhado numa grade de 24 x 48 "pixels" da arte e
// ampliado sem suavizar, em cache por pose; (x, y) é o pé, h a altura na tela.

type Pose = 'stand' | 'paper' | 'wave' | 'nozzle';
const cache = new Map<string, HTMLCanvasElement>();
const GW = 24, GH = 48;

// pinta a grade a partir de linhas de texto: cada caractere é uma cor da paleta (espaço = vazio)
function sprite(rows: string[], pal: Record<string, string>) {
  const cv = document.createElement('canvas');
  cv.width = GW;
  cv.height = GH;
  const g = cv.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y + GH - rows.length, 1, 1);
    }
  });
  // contorno escuro de 1 pixel (como os sprites dos carros)
  const img = g.getImageData(0, 0, GW, GH);
  const d = img.data, src = new Uint8ClampedArray(d);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = (y * GW + x) * 4;
      if (src[i + 3]) continue;
      const n = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
        const xx = x + dx, yy = y + dy;
        return xx >= 0 && yy >= 0 && xx < GW && yy < GH && src[(yy * GW + xx) * 4 + 3];
      });
      if (n) {
        d[i] = 16;
        d[i + 1] = 14;
        d[i + 2] = 20;
        d[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// policial rodoviário: quepe, camisa azul-clara com divisas e distintivo, calça azul-marinho com
// faixa amarela, cinto preto com coldre; braços conforme a pose
const COP_PAL: Record<string, string> = {
  K: '#141a30', k: '#22305a', y: '#e8c018', s: '#e0b088', S: '#c08a62', e: '#1a1a1a', B: '#6a8ad0', b: '#4a68b0',
  W: '#f6f2e6', w: '#c8c0a8', n: '#1c2440', L: '#0c0c0c', g: '#3a3a3a',
};
function copRows(pose: Pose): string[] {
  const arms = pose === 'paper'
    ? ['   bBBBBBBBBBBBbWWWW   ', '   bBBBBBBBBBBBbWwwW   ', '   bBBBBBBBBBBBbWWWW   ', '   ss BBBBBBBB  ss     ']
    : pose === 'wave'
      ? ['   bBBBBBBBBBBBb  ss   ', '   bBBBBBBBBBBBb bB    ', '   bBBBBBBBBBBBbbB     ', '   ss BBBBBBBB         ']
      : ['   bBBBBBBBBBBBb       ', '   bBBBBBBBBBBBb       ', '   bBBBBBBBBBBBb       ', '   ss BBBBBBBB  ss     '];
  return [
    '        kkkkkk          ',
    '       kKKKKKKk         ',
    '      kKKKyyKKKk        ',
    '      LLLLLLLLLL        ',
    '        ssssss          ',
    '        seesse          ',
    '        ssssss          ',
    '        sSSSSs          ',
    '         ssss           ',
    '      BBBWWBBB          ',
    '     bBBBWWBBBBb        ',
    '    bBBBBBBBBBBBb       ',
    '    bBkkBByBBkkBb       ',
    '    bBBBBBBBBBBBb       ',
    ...arms.map((r) => r.slice(0, 24)),
    '      LLLLyLLLLg        ',
    '      nnnnnnnnnn        ',
    '      nnnnnnnnnn        ',
    '      nynnn nnyn        ',
    '      nynnn nnyn        ',
    '      nynnn nnyn        ',
    '      nynnn nnyn        ',
    '      nynn   nyn        ',
    '      nynn   nyn        ',
    '      nynn   nyn        ',
    '      nnnn   nnn        ',
    '      nnnn   nnn        ',
    '     LLLLL   LLLL       ',
    '     LLLLL   LLLLL      ',
  ];
}

// frentista: boné e macacão na cor do posto (vermelho com faixa branca), crachá; com a mangueira
// da bomba na mão quando está abastecendo
const ATT_PAL: Record<string, string> = {
  R: '#c82020', r: '#962018', W: '#f4f4f0', s: '#e8b890', S: '#c89068', e: '#1a1a1a', h: '#4a2a14',
  L: '#1a1a1a', y: '#ffd21a', G: '#3a3a3e', g: '#8a8a92', N: '#1a3aa8',
};
function attRows(pose: Pose): string[] {
  const arms = pose === 'nozzle'
    ? ['   rRRRWRRRRRRRRssGGgg ', '   rRRRWRRRRRRRRr  Gg  ', '   rRRRWRRRRRRRRr      ', '   ss RRRRRRRR         ']
    : pose === 'wave'
      ? ['   rRRRWRRRRRRRRr ss   ', '   rRRRWRRRRRRRRrrR    ', '   rRRRWRRRRRRRRrR     ', '   ss RRRRRRRR         ']
      : ['   rRRRWRRRRRRRRr      ', '   rRRRWRRRRRRRRr      ', '   rRRRWRRRRRRRRr      ', '   ss RRRRRRRR  ss     '];
  return [
    '        RRRRRR          ',
    '       RRRRRRRR         ',
    '       RRRWWRRRRRR      ',
    '       hhhhhhhh         ',
    '        ssssss          ',
    '        seesse          ',
    '        ssssss          ',
    '        sSSSSs          ',
    '         ssss           ',
    '      RRRWWRRR          ',
    '     rRRRRRRRRRr        ',
    '    rRRRWRRRRyyRr       ',
    '    rRRRWRRRRNNRr       ',
    '    rRRRWRRRRRRRr       ',
    ...arms.map((r) => r.slice(0, 24)),
    '      RRRRRRRRRR        ',
    '      RRRRRRRRRR        ',
    '      RRRRRRRRRR        ',
    '      RRRRR RRRR        ',
    '      RRRRR RRRR        ',
    '      RWRRR RRWR        ',
    '      RWRRR RRWR        ',
    '      RWRR   RWR        ',
    '      RWRR   RWR        ',
    '      RRRR   RRR        ',
    '      rrrr   rrr        ',
    '      rrrr   rrr        ',
    '     LLLLL   LLLL       ',
    '     LLLLL   LLLLL      ',
  ];
}

function person(kind: 'cop' | 'att', pose: Pose) {
  const key = `${kind}:${pose}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = kind === 'cop' ? sprite(copRows(pose), COP_PAL) : sprite(attRows(pose), ATT_PAL);
    cache.set(key, cv);
  }
  return cv;
}

// desenha o personagem com o pé em (x, y) e altura h na tela; flip espelha (olha para a esquerda)
export function drawPerson(c: CanvasRenderingContext2D, kind: 'cop' | 'att', pose: Pose, x: number, y: number, h: number, flip = false) {
  if (h < 3) return;
  const cv = person(kind, pose);
  const s = h / 34; // a figura ocupa as 34 linhas de baixo da grade
  const w = GW * s;
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(Math.round(x - w * 0.3), Math.round(y - s), Math.round(w * 0.55), Math.max(1, Math.round(s * 1.5)));
  if (flip) {
    c.translate(Math.round(x), 0);
    c.scale(-1, 1);
    c.drawImage(cv, Math.round(-w * 0.42), Math.round(y - GH * s), Math.round(w), Math.round(GH * s));
  } else c.drawImage(cv, Math.round(x - w * 0.42), Math.round(y - GH * s), Math.round(w), Math.round(GH * s));
  c.restore();
}
