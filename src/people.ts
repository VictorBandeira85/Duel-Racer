// Personagens em pixel art desenhados por código: o policial rodoviário (na pista, ao lado da
// viatura) e o frentista do posto. Cada um é desenhado numa grade de 48 x 96 "pixels" da arte e
// ampliado sem suavizar, em cache por pose; (x, y) é o pé, h a altura na tela.

type Pose = 'stand' | 'paper' | 'wave' | 'nozzle';
const cache = new Map<string, HTMLCanvasElement>();

// Versão em alta (16 bits em HD): grade de 48 x 96, desenhada com formas em 4x e reduzida pegando
// um pixel por bloco, com luz à esquerda, sombra à direita e contorno escuro (como os carros).
const HW = 48, HH = 96, FIG = 68; // a figura ocupa as 68 linhas de baixo
function hiFigure(kind: 'cop' | 'att', pose: Pose) {
  const S = 4;
  const big = document.createElement('canvas');
  big.width = HW * S;
  big.height = HH * S;
  const g = big.getContext('2d')!;
  g.setTransform(S, 0, 0, S, 0, HH * S - FIG * S); // y = 0 no alto da cabeça
  g.imageSmoothingEnabled = false;
  const R = (col: string, x: number, y: number, w: number, h: number) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  const P = (col: string, ...pts: number[]) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fill();
  };
  const E = (col: string, x: number, y: number, rx: number, ry: number) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const cop = kind === 'cop';
  // cores: camisa, sombra, luz; calça; boné
  const shirt = cop ? ['#5a7cc4', '#3e5c9e', '#86a4e0'] : ['#c62222', '#8e1a14', '#ea4a3a'];
  const pants = cop ? ['#1c2440', '#10162a', '#2c3860'] : ['#c62222', '#8e1a14', '#ea4a3a'];
  const skin = ['#e2b088', '#bc8660', '#f4caa4'];
  const cx = 18; // eixo do corpo
  // sapatos
  R('#141414', cx - 9, 64, 8, 4); R('#141414', cx + 2, 64, 8, 4); R('#3a3a3a', cx - 8, 64, 3, 1); R('#3a3a3a', cx + 3, 64, 3, 1);
  // pernas
  R(pants[0], cx - 8, 40, 7, 25); R(pants[0], cx + 2, 40, 7, 25);
  R(pants[2], cx - 8, 40, 2, 25); R(pants[1], cx + 7, 40, 2, 25); R(pants[1], cx - 1, 44, 1, 21);
  if (cop) { R('#e8c018', cx - 6, 41, 1, 23); R('#e8c018', cx + 7, 41, 1, 23); }
  else { R('#f4f4f0', cx - 8, 52, 7, 2); R('#f4f4f0', cx + 2, 52, 7, 2); }
  // cinto
  R('#101010', cx - 9, 38, 19, 3); R('#c8a020', cx - 1, 38, 3, 3);
  if (cop) { R('#1a1a1a', cx + 8, 37, 4, 7); R('#2e2e2e', cx + 8, 37, 1, 7); }
  // tronco
  P(shirt[0], cx - 10, 17, cx + 10, 17, cx + 10, 38, cx - 9, 38);
  P(shirt[2], cx - 10, 17, cx - 5, 17, cx - 6, 38, cx - 9, 38);
  P(shirt[1], cx + 6, 17, cx + 10, 17, cx + 10, 38, cx + 6, 38);
  R(shirt[1], cx - 1, 19, 1, 19); // abotoamento / zíper
  if (cop) {
    R('#f6f2e6', cx - 3, 17, 6, 3); // gola
    R('#22305a', cx - 10, 17, 5, 2); R('#22305a', cx + 5, 17, 5, 2); // divisas
    R('#e8c018', cx + 3, 22, 3, 3); R('#b8901a', cx + 5, 23, 1, 2); // distintivo
    R(shirt[1], cx - 8, 22, 5, 4); R(shirt[1], cx + 3, 27, 5, 1); // bolsos
  } else {
    R('#f4f4f0', cx - 6, 17, 2, 21); // faixa branca
    R('#ffd21a', cx + 3, 21, 5, 2); R('#1a3aa8', cx + 3, 23, 5, 2); // crachá
  }
  // braços conforme a pose
  const armL = () => { P(shirt[0], cx - 10, 18, cx - 14, 19, cx - 15, 34, cx - 11, 34); P(shirt[2], cx - 14, 19, cx - 13, 19, cx - 14, 34, cx - 15, 34); E(skin[0], cx - 13, 36, 2.2, 2.4); };
  armL();
  if (pose === 'wave') {
    P(shirt[0], cx + 10, 18, cx + 14, 18, cx + 18, 6, cx + 15, 5);
    P(shirt[1], cx + 13, 18, cx + 14, 18, cx + 18, 6, cx + 17, 6);
    E(skin[0], cx + 17, 3, 2.4, 2.6); R(skin[1], cx + 18, 2, 1, 3);
  } else if (pose === 'paper') {
    P(shirt[0], cx + 9, 18, cx + 13, 19, cx + 16, 29, cx + 12, 30);
    E(skin[0], cx + 16, 30, 2.2, 2.2);
    R('#f6f2e6', cx + 14, 22, 9, 11); R('#c8c0a8', cx + 21, 22, 2, 11);
    for (let i = 0; i < 4; i++) R('#8a8478', cx + 15, 24 + i * 2, 5, 0.6);
  } else if (pose === 'nozzle') {
    P(shirt[0], cx + 9, 18, cx + 13, 19, cx + 19, 28, cx + 16, 30);
    E(skin[0], cx + 19, 29, 2.2, 2.2);
    R('#3a3a3e', cx + 18, 26, 9, 3); R('#8a8a92', cx + 18, 26, 9, 1); R('#3a3a3e', cx + 25, 26, 2, 7);
    R('#1a1a1a', cx + 10, 29, 9, 1.4); // mangueira
  } else {
    P(shirt[0], cx + 10, 18, cx + 14, 19, cx + 15, 34, cx + 11, 34); P(shirt[1], cx + 13, 19, cx + 14, 19, cx + 15, 34, cx + 14, 34);
    E(skin[1], cx + 13, 36, 2.2, 2.4);
  }
  // pescoço e cabeça
  R(skin[1], cx - 2, 13, 5, 5);
  E(skin[0], cx, 9, 5.2, 6);
  P(skin[2], cx - 5, 7, cx - 2, 4, cx - 2, 12, cx - 4, 12);
  P(skin[1], cx + 3, 5, cx + 5.2, 8, cx + 4, 13, cx + 2, 14);
  E(skin[1], cx + 5, 9, 1.2, 1.8); // orelha
  R('#1a1a1a', cx - 3, 8, 1.6, 1.4); R('#1a1a1a', cx + 1.5, 8, 1.6, 1.4); // olhos
  R(skin[1], cx - 1, 9, 1.6, 2.6); // nariz
  R('#8a4a3a', cx - 2, 12.4, 4, 0.9); // boca
  if (cop) R('#3a2a1a', cx - 3, 11, 6, 0.9); // bigode
  // quepe / boné
  if (cop) {
    E('#22305a', cx, 3, 6.5, 3); R('#141a30', cx - 6.5, 3, 13, 2.5); R('#0c0c0c', cx - 6, 5, 12, 1.6);
    E('#e8c018', cx, 2.5, 1.5, 1.2); R('#3a4a80', cx - 5, 1.6, 3, 1);
  } else {
    E(shirt[0], cx, 3.2, 5.8, 3.2); R(shirt[0], cx - 5.8, 3.2, 11.6, 2); R(shirt[1], cx + 1, 4.6, 9, 1.8); // aba para a frente
    R('#f4f4f0', cx - 2, 1.6, 4, 2); R('#4a2a14', cx - 5.6, 6, 2, 3); // cabelo
  }
  // redução: um pixel por bloco, transparência 0/1 e contorno escuro
  const cv = document.createElement('canvas');
  cv.width = HW; cv.height = HH;
  const o = cv.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.drawImage(big, 0, 0, HW * S, HH * S, 0, 0, HW, HH);
  const img = o.getImageData(0, 0, HW, HH);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    const i = (y * HW + x) * 4;
    if (src[i + 3]) continue;
    const n = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
      const xx = x + dx, yy = y + dy;
      return xx >= 0 && yy >= 0 && xx < HW && yy < HH && src[(yy * HW + xx) * 4 + 3];
    });
    if (n) { d[i] = 16; d[i + 1] = 14; d[i + 2] = 20; d[i + 3] = 255; }
  }
  o.putImageData(img, 0, 0);
  return cv;
}

function person(kind: 'cop' | 'att', pose: Pose) {
  const key = `${kind}:${pose}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = hiFigure(kind, pose);
    cache.set(key, cv);
  }
  return cv;
}

// desenha o personagem com o pé em (x, y) e altura h na tela; flip espelha (olha para a esquerda)
export function drawPerson(c: CanvasRenderingContext2D, kind: 'cop' | 'att', pose: Pose, x: number, y: number, h: number, flip = false) {
  if (h < 3) return;
  const cv = person(kind, pose);
  const s = h / FIG; // a figura ocupa as linhas de baixo da grade
  const w = HW * s;
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(Math.round(x - w * 0.3), Math.round(y - s), Math.round(w * 0.55), Math.max(1, Math.round(s * 1.5)));
  if (flip) {
    c.translate(Math.round(x), 0);
    c.scale(-1, 1);
    c.drawImage(cv, Math.round(-w * 0.38), Math.round(y - HH * s), Math.round(w), Math.round(HH * s));
  } else c.drawImage(cv, Math.round(x - w * 0.38), Math.round(y - HH * s), Math.round(w), Math.round(HH * s));
  c.restore();
}
