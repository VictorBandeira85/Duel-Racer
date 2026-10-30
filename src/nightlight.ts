// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean }
const lights: Light[] = [];
let collecting = false;

// postes de luz acesos (render3d registra cada um visível: cabeça, chão e raio da luz)
interface Street { x: number; head: number; ground: number; r: number }
const streets: Street[] = [];
export function pushStreetLight(x: number, head: number, ground: number, r: number) {
  if (collecting && r > 2) streets.push({ x, head, ground, r: Math.min(r, 150) }); // perto: não cobre a tela toda
}
export function beginLights() {
  lights.length = 0;
  streets.length = 0;
  collecting = true;
}
// chamado por drawCar: guarda onde estão as luzes do carro (só durante a pista, à noite)
export function pushCarLights(x: number, y: number, w: number, look: CarLook, spots: { h: number; dots: number[][] }) {
  if (!collecting || !look.night || w < 3) return;
  lights.push({ x, y, w, h: spots.h, front: !!look.front, brake: !!look.brake, signal: look.signal ?? 0, dots: spots.dots, high: !!look.flash || !!look.lamps?.high });
}
const blinkOn = () => Math.floor(performance.now() / 250) % 2 === 0;

// Escuridão e facho em pixels do jogo, com degraus de dithering (padrão Bayer 4x4): o mesmo
// visual chapado da pixel art, sem degradê liso. O facho segue o chão (subida: alcança mais alto
// na tela; topo de lombada: acaba ali) e aponta para onde o carro aponta (nas curvas a estrada
// sai do facho, como de verdade).
export interface RoadPt { d: number; y: number; w: number } // distância (segmentos), linha na tela, meia largura da pista
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
let darkCv: HTMLCanvasElement | null = null;
let warmCv: HTMLCanvasElement | null = null;
const REACH = 20; // alcance do farol baixo, em segmentos (~28 m de chão bem iluminado)
function quantize(g: CanvasRenderingContext2D, w: number, h: number, levels: number) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0, i = 3; y < h; y++)
    for (let x = 0; x < w; x++, i += 4) {
      const v = (d[i] / 255) * levels;
      const lo = Math.floor(v);
      d[i] = Math.round(((v - lo > BAYER[(y & 3) * 4 + (x & 3)] ? lo + 1 : lo) / levels) * 255);
    }
  g.putImageData(img, 0, 0);
}
// pinta o facho (alpha) em g: faixas do chão de perto para longe, cada uma pela distância
function beamShape(g: CanvasRenderingContext2D, w: number, cx: number, seen: number, road: RoadPt[], scale: number) {
  // perto do carro (abaixo do primeiro trecho de pista visível): leque largo
  g.save();
  g.translate(cx, seen + 6);
  g.scale(1, 0.28);
  const near = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.75);
  near.addColorStop(0, `rgba(0,0,0,${scale})`);
  near.addColorStop(0.7, `rgba(0,0,0,${0.55 * scale})`);
  near.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = near;
  g.fillRect(-w * 0.75, -w * 0.75, w * 1.5, w * 1.5);
  g.restore();
  // faixas do chão: o facho tem a largura da pista e um pouco mais, centrado no carro
  for (let k = 0; k + 1 < road.length; k++) {
    const p = road[k], q = road[k + 1];
    if (p.d > REACH) break;
    const f = 1 - p.d / REACH;
    const a = scale * Math.min(1, f * f * 1.6);
    if (a <= 0.02) continue;
    const spread = 1.2 - 0.4 * (1 - f);
    g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    g.beginPath();
    g.moveTo(cx - p.w * spread, p.y + 0.5);
    g.lineTo(cx + p.w * spread, p.y + 0.5);
    g.lineTo(cx + q.w * spread, q.y - 0.5);
    g.lineTo(cx - q.w * spread, q.y - 0.5);
    g.closePath();
    g.fill();
  }
}

function blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: string, a: number) {
  if (rx < 0.5 || a <= 0.01) return;
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
  g.addColorStop(0.35, `rgba(${rgb},${(a * 0.45).toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(-rx, -rx, rx * 2, rx * 2);
  c.restore();
}

export interface Pass { x: number; dz: number } // quem vem atrás com farol aceso (dz > 0 atrás)

// fim da pista: escuridão, luzes dos carros somadas e a claridade de quem emparelha
export function finishNight(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number; horizon: number; dash?: number }, strength: number, passers: Pass[], segLen: number, road: RoadPt[] = []) {
  collecting = false;
  if (strength <= 0.02) {
    streets.length = 0;
    return;
  }
  const top = Math.max(vp.y, Math.floor(vp.horizon) - 60);
  const W = Math.max(1, Math.round(vp.w)), H = Math.max(1, Math.round(vp.y + vp.h - top));
  const bot = vp.y + vp.h, seen = Math.min(bot, vp.dash ?? bot);
  const cx = W / 2;
  const rd = road.map((p) => ({ d: p.d, y: p.y - top, w: p.w }));
  // camada da escuridão (pixels do jogo), com o facho recortado
  darkCv = darkCv ?? document.createElement('canvas');
  if (darkCv.width !== W || darkCv.height !== H) {
    darkCv.width = W;
    darkCv.height = H;
  }
  const g = darkCv.getContext('2d', { willReadFrequently: true })!;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.fillStyle = `rgba(0,0,10,${(0.8 * strength).toFixed(3)})`;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  beamShape(g, W, cx, seen - top, rd, 0.9);
  // postes acesos: um cone de luz no chão embaixo de cada um
  for (const st of streets) {
    const pool = g.createRadialGradient(st.x - vp.x, st.ground - top, 0, st.x - vp.x, st.ground - top, st.r);
    pool.addColorStop(0, 'rgba(0,0,0,0.85)');
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.translate(st.x - vp.x, st.ground - top);
    g.scale(1, 0.32);
    g.translate(-(st.x - vp.x), -(st.ground - top));
    g.fillStyle = pool;
    g.fillRect(st.x - vp.x - st.r, st.ground - top - st.r, st.r * 2, st.r * 2);
    g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  quantize(g, W, H, 5);
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(darkCv, vp.x, top);
  // luz amarelada somada no chão iluminado (o asfalto da noite é escuro: só recortar não basta)
  warmCv = warmCv ?? document.createElement('canvas');
  if (warmCv.width !== W || warmCv.height !== H) {
    warmCv.width = W;
    warmCv.height = H;
  }
  const wg = warmCv.getContext('2d', { willReadFrequently: true })!;
  wg.globalCompositeOperation = 'source-over';
  wg.clearRect(0, 0, W, H);
  beamShape(wg, W, cx, seen - top, rd, 0.3);
  wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = 'rgb(255,226,160)';
  wg.fillRect(0, 0, W, H);
  wg.globalCompositeOperation = 'source-over';
  for (const st of streets) { // luz de sódio dos postes
    wg.save();
    wg.translate(st.x - vp.x, st.ground - top);
    wg.scale(1, 0.32);
    const pool = wg.createRadialGradient(0, 0, 0, 0, 0, st.r);
    pool.addColorStop(0, `rgba(255,190,90,${(0.42 * strength).toFixed(3)})`);
    pool.addColorStop(1, 'rgba(255,190,90,0)');
    wg.fillStyle = pool;
    wg.fillRect(-st.r, -st.r, st.r * 2, st.r * 2);
    wg.restore();
  }
  quantize(wg, W, H, 4);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.drawImage(warmCv, vp.x, top);
  c.imageSmoothingEnabled = prev;
  // a lâmpada de cada poste
  for (const st of streets) {
    blob(c, st.x, st.head, st.r * 0.22, st.r * 0.12, '255,200,110', 0.55 * strength);
    blob(c, st.x, st.head, st.r * 0.06, st.r * 0.04, '255,240,200', 0.9 * strength);
  }
  streets.length = 0;
  // as luzes vêm do mais longe para o mais perto: o brilho de cada carro não passa por cima da
  // carroceria dos carros mais perto (recorte com os retângulos deles)
  for (let li = 0; li < lights.length; li++) {
    const l = lights[li];
    let clipped = false;
    for (let j = li + 1; j < lights.length; j++) {
      const n = lights[j];
      if (n.w <= l.w) continue; // mesmo tamanho ou menor: não está mais perto
      if (!clipped) c.save();
      clipped = true;
      // cada recorte se soma aos anteriores (interseção): fora de todos os carros mais perto
      c.beginPath();
      c.rect(vp.x, vp.y - 50, vp.w, vp.h + 100);
      c.rect(n.x - n.w / 2, n.y - n.h, n.w, n.h);
      c.clip('evenodd');
    }
    const L = l.x - l.w / 2, T = l.y - l.h;
    const pts = l.dots.map(([u, f]) => [L + u * l.w, T + f * l.h]);
    if (l.front) {
      // faróis de quem vem de frente: foco forte em cada farol, halo e o clarão na pista à frente
      const k = l.high ? 1.5 : 1;
      for (const [px, py] of pts) {
        blob(c, px, py, l.w * 0.55 * k, l.w * 0.4 * k, '255,244,200', 0.75 * strength);
        blob(c, px, py, l.w * 0.16, l.w * 0.13, '255,255,245', 1 * strength);
        // raios curtos (estrela) dos faróis vistos de frente
        c.fillStyle = `rgba(255,250,225,${(0.5 * strength).toFixed(3)})`;
        c.fillRect(px - l.w * 0.5 * k, py - 0.5, l.w * k, 1);
        c.fillRect(px - 0.5, py - l.w * 0.18 * k, 1, l.w * 0.36 * k);
      }
      // clarão no asfalto entre o carro e o jogador
      blob(c, l.x, l.y + l.w * 0.08, l.w * 1.3 * k, l.w * 0.26, '255,240,190', 0.38 * strength);
    } else {
      // lanternas: brilho vermelho em cada lâmpada; no freio fica bem mais forte, com halo
      // grande e o reflexo vermelho no asfalto atrás do carro
      for (const [px, py] of pts) {
        if (l.brake) {
          blob(c, px, py, l.w * 0.42, l.w * 0.3, '255,30,16', 0.32 * strength);
          blob(c, px, py, l.w * 0.13, l.w * 0.1, '255,90,60', 0.85 * strength);
        } else {
          blob(c, px, py, l.w * 0.2, l.w * 0.14, '255,36,20', 0.42 * strength);
          blob(c, px, py, l.w * 0.06, l.w * 0.05, '255,80,50', 0.6 * strength);
        }
      }
      blob(c, l.x, l.y + l.w * 0.03, l.w * (l.brake ? 0.85 : 0.6), l.w * 0.1, '255,30,16', (l.brake ? 0.28 : 0.12) * strength);
    }
    // seta piscando: brilho âmbar do lado para onde vai
    if (l.signal && blinkOn()) {
      const [px, py] = pts[l.signal > 0 ? pts.length - 1 : 0] ?? [l.x, l.y - l.h / 2];
      const sx = l.front ? (l.signal > 0 ? L + l.w * 0.08 : L + l.w * 0.92) : px; // de frente o lado se inverte
      blob(c, sx, py, l.w * 0.22, l.w * 0.16, '255,160,30', 0.6 * strength);
    }
    if (clipped) c.restore();
  }
  // quem vem atrás com farol aceso: o lado por onde passa clareia, mais forte ao emparelhar,
  // esmaecendo quando ele já passou
  for (const p of passers) {
    const ahead = -p.dz;
    const f = p.dz > 0 ? Math.max(0, 1 - p.dz / (segLen * 12)) ** 1.5 : Math.max(0, 1 - ahead / (segLen * 2.5));
    if (f <= 0.01) continue;
    const right = p.x > 0;
    const x0 = right ? vp.x + vp.w : vp.x;
    const g = c.createLinearGradient(x0, 0, x0 + (right ? -1 : 1) * vp.w * 0.5, 0);
    g.addColorStop(0, `rgba(255,236,190,${(0.4 * f * strength).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,236,190,0)');
    c.fillStyle = g;
    c.fillRect(vp.x, vp.horizon, vp.w, vp.y + vp.h - vp.horizon);
  }
  c.restore();
}

// ofuscamento no retrovisor: o farol de quem vem atrás brilha e clareia o espelho
export function mirrorGlare(c: CanvasRenderingContext2D, x: number, y: number, bw: number, near: number, strength: number) {
  if (strength <= 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const s of [-0.3, 0.3]) blob(c, x + s * bw, y - bw * 0.28, Math.max(1.5, bw * 0.45), Math.max(1, bw * 0.3), '255,246,210', (0.45 + 0.5 * near) * strength);
  c.restore();
}
export function mirrorWash(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, near: number, strength: number) {
  if (near <= 0.01 || strength <= 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(255,240,205,${(0.35 * near * strength).toFixed(3)})`;
  c.fillRect(x, y, w, h);
  c.restore();
}
