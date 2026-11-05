// Brilhos e sombras redondos prontos (um degradê desenhado uma vez numa imagem de 64 px e
// reaproveitado, ampliado): antes cada farol, halo e mostrador criava um degradê novo a cada quadro
const sprites = new Map<string, HTMLCanvasElement>();

export type Stops = [number, number][]; // [posição 0..1, força 0..1]
export const FALL: Stops = [[0, 1], [1, 0]];

function sprite(rgb: string, stops: Stops) {
  const key = `${rgb}|${stops.join(';')}`;
  let cv = sprites.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, a] of stops) gr.addColorStop(o, `rgba(${rgb},${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, cv);
  }
  return cv;
}

// brilho de raio rx (e ry na vertical) centrado em (x, y), com força máxima a (0..1)
export function drawGlow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: string, a: number, stops: Stops = FALL) {
  if (a <= 0.003 || rx <= 0 || ry <= 0) return;
  const ga = c.globalAlpha;
  const sm = c.imageSmoothingEnabled;
  c.globalAlpha = ga * Math.min(1, a);
  c.imageSmoothingEnabled = true;
  c.drawImage(sprite(rgb, stops), x - rx, y - ry, rx * 2, ry * 2);
  c.globalAlpha = ga;
  c.imageSmoothingEnabled = sm;
}
