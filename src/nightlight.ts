// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean; clip: number }
const lights: Light[] = [];
let collecting = false;

// postes de luz acesos (render3d registra cada um visível: lâmpada na tela, tamanho, trecho da
// pista onde está e posição lateral em meias larguras da pista a partir do centro)
interface Street { x: number; head: number; r: number; d: number; u: number }
const streets: Street[] = [];
export function pushStreetLight(x: number, head: number, r: number, d: number, u: number) {
  if (collecting && r > 2) streets.push({ x, head, r: Math.min(r, 110), d, u });
}
// linha da tela abaixo da qual o trecho sendo desenhado fica escondido (crista de morro à frente)
let clipY = Infinity;
export function setLightClip(y: number) {
  clipY = y;
}
export function beginLights() {
  clipY = Infinity;
  lights.length = 0;
  streets.length = 0;
  collecting = true;
}
// chamado por drawCar: guarda onde estão as luzes do carro (só durante a pista, à noite)
export function pushCarLights(x: number, y: number, w: number, look: CarLook, spots: { h: number; dots: number[][] }) {
  if (!collecting || !look.night || w < 1.5) return;
  lights.push({ x, y, w, h: spots.h, front: !!look.front, brake: !!look.brake, signal: look.signal ?? 0, dots: spots.dots, high: !!look.flash || !!look.lamps?.high, clip: clipY });
}
const blinkOn = () => Math.floor(performance.now() / 250) % 2 === 0;

// Escuridão e facho em pixels do jogo, em degraus chapados: o mesmo visual da pixel art, sem
// degradê liso. O facho segue o chão (subida: alcança mais alto
// na tela; topo de lombada: acaba ali) e aponta para onde o carro aponta (nas curvas a estrada
// sai do facho, como de verdade).
export interface RoadPt { d: number; x: number; y: number; w: number } // distância (segmentos), centro e linha na tela, meia largura da pista
let darkCv: HTMLCanvasElement | null = null;
let warmCv: HTMLCanvasElement | null = null;
const REACH = 20; // alcance do farol baixo, em segmentos (~28 m de chão bem iluminado)
// degraus chapados (sem pontilhado): cada pixel vai para o nível mais próximo; a escuridão lisa
// continua lisa e o facho vira poucas faixas de luz bem definidas, como na pixel art
function quantize(g: CanvasRenderingContext2D, w: number, h: number, levels: number) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = Math.round(Math.round((d[i] / 255) * levels) / levels * 255);
  g.putImageData(img, 0, 0);
}
// pinta o facho (alpha) em g: faixas do chão de perto para longe, cada uma pela distância
// trecho contínuo de chão à frente do carro: para na crista (o que vem depois do topo da subida
// está escondido; a luz que passa da crista vai para o ar e não aparece em nada)
function groundAhead(road: RoadPt[]) {
  let n = 0;
  while (n + 1 < road.length && road[n + 1].d - road[n].d <= 2) n++;
  return road.slice(0, n + 1);
}
function beamShape(g: CanvasRenderingContext2D, w: number, cx: number, seen: number, road: RoadPt[], scale: number) {
  // perto do carro (abaixo do primeiro trecho de pista visível): leque na frente do capô, sem
  // se espalhar pelos lados e sem subir além do chão que se vê (no topo da subida não pinta o céu)
  const lit = road.filter((p) => p.d <= REACH);
  const crest = lit.length ? lit[lit.length - 1].y : seen;
  g.save();
  g.beginPath();
  g.rect(0, crest, w, seen + 40 - crest);
  g.clip();
  g.translate(cx, seen + 6);
  g.scale(1, 0.32);
  const near = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.42);
  near.addColorStop(0, `rgba(0,0,0,${0.85 * scale})`);
  near.addColorStop(0.6, `rgba(0,0,0,${0.45 * scale})`);
  near.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = near;
  g.fillRect(-w * 0.42, -w * 0.42, w * 0.84, w * 0.84);
  g.restore();
  g.restore();
  // faixas do chão: o facho tem a largura da pista e um pouco mais, centrado no carro
  for (let k = 0; k + 1 < road.length; k++) {
    const p = road[k], q = road[k + 1];
    if (p.d > REACH) break;
    const f = 1 - p.d / REACH;
    const a = scale * Math.min(1, f * f * 1.6);
    if (a <= 0.02) continue;
    // facho principal na largura da faixa do carro e um pouco mais; dos lados só uma sobra fraca
    const strip = (s0: number, s1: number, alpha: number) => {
      g.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + sgn * p.w * s0, p.y + 0.5);
        g.lineTo(cx + sgn * p.w * s1, p.y + 0.5);
        g.lineTo(cx + sgn * q.w * s1, q.y - 0.5);
        g.lineTo(cx + sgn * q.w * s0, q.y - 0.5);
        g.closePath();
        g.fill();
      }
    };
    const main = 0.75 - 0.25 * (1 - f);
    strip(0, main, a);
    strip(main, main + 0.45, a * 0.3);
  }
}

// luz de um poste no chão: faixas da pista em volta do trecho do poste (só o chão que se vê, então
// nunca pinta o céu atrás de uma crista), mais forte embaixo da lâmpada e caindo em degraus para
// a frente, para trás e para os lados
const POOL = 6; // raio do círculo de luz, em segmentos
function streetPool(g: CanvasRenderingContext2D, road: RoadPt[], st: Street, rgb: string, a0: number) {
  for (let k = 0; k + 1 < road.length; k++) {
    const p = road[k], q = road[k + 1];
    if (q.d - p.d > 2) continue; // entre os dois há chão escondido (crista)
    const dd = Math.abs((p.d + q.d) / 2 - st.d);
    if (dd > POOL) continue;
    const f = 1 - dd / POOL;
    // para o lado da pista a luz vai mais longe que para fora (o braço do poste fica sobre o acostamento)
    const t = st.u > 0 ? 1 : -1;
    for (const [s0, s1, k2] of [[-1.5, 0.4, 1], [-2.3, -1.5, 0.45], [0.4, 0.9, 0.45]]) {
      const a = a0 * k2 * Math.min(1, f * f * 1.5);
      if (a <= 0.02) continue;
      g.fillStyle = `${rgb}${a.toFixed(3)})`;
      const u0 = st.u + t * s0, u1 = st.u + t * s1;
      g.beginPath();
      g.moveTo(p.x + p.w * u0, p.y + 0.5);
      g.lineTo(p.x + p.w * u1, p.y + 0.5);
      g.lineTo(q.x + q.w * u1, q.y - 0.5);
      g.lineTo(q.x + q.w * u0, q.y - 0.5);
      g.closePath();
      g.fill();
    }
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
  const rd = road.map((p) => ({ d: p.d, x: p.x - vp.x, y: p.y - top, w: p.w }));
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
  const ground = groundAhead(rd);
  beamShape(g, W, cx, seen - top, ground, 0.9);
  // postes acesos: o círculo de luz no chão embaixo de cada um, deitado na pista como o facho
  for (const st of streets) streetPool(g, rd, st, 'rgba(0,0,0,', 0.85);
  g.globalCompositeOperation = 'source-over';
  quantize(g, W, H, 6);
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
  beamShape(wg, W, cx, seen - top, ground, 0.3);
  wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = 'rgb(255,226,160)';
  wg.fillRect(0, 0, W, H);
  wg.globalCompositeOperation = 'source-over';
  for (const st of streets) streetPool(wg, rd, st, 'rgba(255,190,90,', 0.3 * strength); // luz de sódio
  quantize(wg, W, H, 6);
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
    // lâmpadas atrás de uma crista não aparecem (o carro está escondido pelo morro)
    const pts = l.dots.map(([u, f]) => [L + u * l.w, T + f * l.h]).filter(([, py]) => py <= l.clip + 1);
    if (!pts.length) {
      if (clipped) c.restore();
      continue;
    }
    if (l.front) {
      // faróis de quem vem de frente: foco forte em cada farol, halo e o clarão na pista à frente
      const k = l.high ? 1.5 : 1;
      for (const [px, py] of pts) {
        blob(c, px, py, Math.max(l.w * 0.55 * k, 5), Math.max(l.w * 0.4 * k, 3.5), '255,244,200', 0.75 * strength);
        blob(c, px, py, Math.max(l.w * 0.16, 1.6), Math.max(l.w * 0.13, 1.3), '255,255,245', 1 * strength);
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
      // de longe a lâmpada continua um ponto vermelho bem visível (tamanho mínimo e mais forte),
      // como lanterna acesa na estrada escura
      const far = Math.max(0, Math.min(1, (24 - l.w) / 18)); // 1 = bem longe
      const m = (v: number, min: number) => Math.max(v, min * far);
      for (const [px, py] of pts) {
        if (l.brake) {
          blob(c, px, py, m(l.w * 0.42, 5), m(l.w * 0.3, 3.5), '255,30,16', 0.32 * strength);
          blob(c, px, py, m(l.w * 0.13, 1.8), m(l.w * 0.1, 1.5), '255,90,60', 0.85 * strength);
        } else {
          blob(c, px, py, m(l.w * 0.2, 3.5), m(l.w * 0.14, 2.5), '255,36,20', (0.42 + 0.2 * far) * strength);
          blob(c, px, py, m(l.w * 0.06, 1.4), m(l.w * 0.05, 1.2), '255,80,50', (0.6 + 0.35 * far) * strength);
        }
      }
      blob(c, l.x, l.y + l.w * 0.03, l.w * (l.brake ? 0.85 : 0.6), l.w * 0.1, '255,30,16', (l.brake ? 0.28 : 0.12) * strength);
    }
    // seta piscando: brilho âmbar do lado para onde vai
    if (l.signal && blinkOn()) {
      const [px, py] = pts[l.signal > 0 ? pts.length - 1 : 0] ?? [l.x, l.y - l.h / 2];
      const sx = l.front ? (l.signal > 0 ? L + l.w * 0.08 : L + l.w * 0.92) : px; // de frente o lado se inverte
      const far = Math.max(0, Math.min(1, (24 - l.w) / 18));
      blob(c, sx, py, Math.max(l.w * 0.22, 4 * far), Math.max(l.w * 0.16, 3 * far), '255,160,30', (0.6 + 0.3 * far) * strength);
      blob(c, sx, py, Math.max(l.w * 0.07, 1.5 * far), Math.max(l.w * 0.05, 1.2 * far), '255,215,120', (0.5 + 0.4 * far) * strength);
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
