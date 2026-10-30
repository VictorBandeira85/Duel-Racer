// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean; clip: number; shape?: (g: CanvasRenderingContext2D) => void; plate?: number[] }
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
// fachadas iluminadas (posto de gasolina e a placa dele): retângulo do sprite na tela
interface Facade { kind: 'station' | 'gasSign'; x: number; y: number; w: number; h: number; clip: number }
const fronts: Facade[] = [];
export function pushFacade(kind: Facade['kind'], x: number, y: number, w: number, h: number) {
  if (collecting && w > 1) fronts.push({ kind, x, y, w, h, clip: clipY });
}
// o posto aceso de noite: cobertura branca brilhando, faixa vermelha, a loja iluminada, a luz que
// desce da cobertura para as bombas e um halo que se vê de longe na estrada escura
function facades(c: CanvasRenderingContext2D, strength: number) {
  for (const f of fronts) {
    const { x, y, w, h } = f;
    c.save();
    c.beginPath();
    c.rect(x - w * 2, y - h * 2, w * 4, Math.min(h * 2, f.clip + 1 - (y - h * 2)));
    c.clip();
    if (f.kind === 'station') {
      const L = x - w / 2, cw = w * 0.56;
      blob(c, L + cw / 2, y - h * 0.85, Math.max(cw * 0.9, 8), Math.max(h * 0.35, 4), '255,250,230', 0.22 * strength);
      c.fillStyle = `rgba(255,255,245,${(0.75 * strength).toFixed(3)})`;
      c.fillRect(L, y - h * 0.92, cw, h * 0.09);
      c.fillStyle = `rgba(255,60,40,${(0.7 * strength).toFixed(3)})`;
      c.fillRect(L, y - h * 0.83, cw, h * 0.05);
      // luz descendo da cobertura até o chão das bombas
      c.fillStyle = `rgba(255,250,225,${(0.16 * strength).toFixed(3)})`;
      c.beginPath();
      c.moveTo(L + cw * 0.04, y - h * 0.78);
      c.lineTo(L + cw * 0.96, y - h * 0.78);
      c.lineTo(L + cw * 1.12, y);
      c.lineTo(L - cw * 0.12, y);
      c.closePath();
      c.fill();
      c.fillStyle = `rgba(255,250,225,${(0.28 * strength).toFixed(3)})`;
      c.fillRect(L - cw * 0.15, y - h * 0.04, cw * 1.3, h * 0.06);
      // vitrine da loja
      c.fillStyle = `rgba(200,230,255,${(0.55 * strength).toFixed(3)})`;
      c.fillRect(x + w * 0.14, y - h * 0.38, w * 0.2, h * 0.2);
    } else {
      blob(c, x, y - h * 0.78, Math.max(w * 0.9, 6), Math.max(h * 0.35, 4), '140,170,255', 0.28 * strength);
      // a placa iluminada por dentro: o painel clareia, mantendo o desenho (letras e faixas)
      c.fillStyle = `rgba(90,120,220,${(0.3 * strength).toFixed(3)})`;
      c.fillRect(x - w / 2, y - h, w, h * 0.45);
      c.fillStyle = `rgba(255,255,240,${(0.3 * strength).toFixed(3)})`;
      c.fillRect(x - w / 2 + w * 0.04, y - h * 0.68, w * 0.92, h * 0.1);
    }
    c.restore();
  }
  fronts.length = 0;
}
// placas e outdoors que o farol alcança: brilham mais conforme o carro se aproxima
interface Reflector { kind: string; x: number; y: number; w: number; h: number; dist: number; clip: number }
const refl: Reflector[] = [];
export function pushReflector(kind: string, x: number, y: number, w: number, h: number, dist: number) {
  if (collecting && w > 1.5 && dist < 120) refl.push({ kind, x, y, w, h, dist, clip: clipY });
}
// o farol ilumina a face da placa: recorta a escuridão em cima dela (as cores verdadeiras
// aparecem, mais fortes conforme o carro chega perto); (ox, oy) desloca para a camada da escuridão
function reflectors(g: CanvasRenderingContext2D, ox: number, oy: number, rgb: string, mul: number) {
  for (const r of refl) {
    const k = Math.min(1, (1 - r.dist / 120) * 1.5) ** 1.3; // começa a refletir de longe; perto: mais claro
    if (k <= 0.02) continue;
    const x = r.x - ox, y = r.y - oy, { w, h } = r;
    g.save();
    g.beginPath();
    g.rect(x - w, y - h * 1.2, w * 2, Math.min(h * 1.2, r.clip - oy + 1 - (y - h * 1.2)));
    g.clip();
    // placas refletivas acendem mais que o papel dos outdoors
    const a = (r.kind === 'billboard' ? 0.75 : 0.95) * k * mul;
    g.fillStyle = `${rgb}${a.toFixed(3)})`;
    if (r.kind === 'billboard') g.fillRect(x - w / 2, y - h, w, h * 0.52);
    else if (r.kind === 'gasSign') g.fillRect(x - w / 2, y - h, w, h * 0.45);
    else if (r.kind.startsWith('warn') || r.kind.startsWith('sharp')) {
      const cy = y - h * 0.78, rr = w * 0.5;
      g.beginPath();
      g.moveTo(x, cy - rr);
      g.lineTo(x + rr, cy);
      g.lineTo(x, cy + rr);
      g.lineTo(x - rr, cy);
      g.closePath();
      g.fill();
    } else if (r.kind === 'stop') g.fillRect(x - w / 2, y - h, w, h * 0.45);
    else g.fillRect(x - w / 2, y - h, w, h * 0.55);
    g.restore();
  }
}
export function beginLights() {
  lastLight = null;
  refl.length = 0;
  fronts.length = 0;
  clipY = Infinity;
  lights.length = 0;
  streets.length = 0;
  collecting = true;
}
// chamado por drawCar: guarda onde estão as luzes do carro (só durante a pista, à noite)
// placa iluminada do último carro registrado (drawPlate é chamado logo depois de pushCarLights)
let lastLight: Light | null = null;
export function pushPlateLight(x: number, y: number, w: number, h: number) {
  if (collecting && lastLight && !lastLight.front) lastLight.plate = [x, y, w, h];
  lastLight = null;
}
// shape: redesenha o carro (só a silhueta importa) para recortar a luz dos carros de trás
export function pushCarLights(x: number, y: number, w: number, look: CarLook, spots: { h: number; dots: number[][] }, shape?: (g: CanvasRenderingContext2D) => void) {
  if (!collecting || !look.night || w < 1.5) return;
  lights.push({ x, y, w, h: spots.h, front: !!look.front, brake: !!look.brake, signal: look.signal ?? 0, dots: spots.dots, high: !!look.flash || !!look.lamps?.high, clip: clipY, shape });
  lastLight = lights[lights.length - 1];
}
const blinkOn = () => Math.floor(performance.now() / 250) % 2 === 0;

// Escuridão e facho em pixels do jogo, em degraus chapados: o mesmo visual da pixel art, sem
// degradê liso. O facho segue o chão (subida: alcança mais alto
// na tela; topo de lombada: acaba ali) e aponta para onde o carro aponta (nas curvas a estrada
// sai do facho, como de verdade).
export interface RoadPt { d: number; x: number; y: number; w: number } // distância (segmentos), centro e linha na tela, meia largura da pista
let darkCv: HTMLCanvasElement | null = null;
const occCv = document.createElement('canvas'), tmpCv = document.createElement('canvas');
let warmCv: HTMLCanvasElement | null = null;
const REACH = 30; // alcance do farol baixo, em segmentos (~35 m de chão bem iluminado)
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
  // facho em trapézio que abre com a distância: estreito na frente do capô e cada vez mais largo
  // à frente, pegando a outra mão, o acostamento e o canteiro; bordas retas, só o chão que se vê
  const width = (f: number) => 1.75 - 1.1 * f; // em meias larguras da pista; f = 1 perto, 0 no fim (abre com a distância)
  const quad = (x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, alpha: number) => {
    g.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
    g.beginPath();
    g.moveTo(x0 - h0, y0);
    g.lineTo(x0 + h0, y0);
    g.lineTo(x1 + h1, y1);
    g.lineTo(x1 - h1, y1);
    g.closePath();
    g.fill();
  };
  // perto do carro, abaixo do primeiro trecho de pista visível: continua o trapézio até o painel
  // o alcance conta a partir do chão que aparece acima do capô/painel: num carro de painel alto
  // (o trecho perto fica escondido) o facho continua aparecendo à frente
  const d0 = Math.max(0, (road.find((p) => p.y < seen - 1)?.d ?? 0) - 6);
  const fd = (d: number) => 1 - (d - d0) / REACH;
  const p0 = road[0];
  if (p0 && fd(p0.d) >= 0) {
    const h0 = p0.w * width(fd(p0.d));
    quad(cx, seen + 6, cx, p0.y + 0.5, h0 * 0.85, h0, scale * 0.5);
    quad(cx, seen + 6, cx, p0.y + 0.5, h0 * 0.6, h0 * 0.7, scale * 0.45);
    quad(cx, seen + 6, cx, p0.y + 0.5, h0 * 0.36, h0 * 0.42, scale * 0.45);
  }
  for (let k = 0; k + 1 < road.length; k++) {
    // longe, dois trechos por vez (o facho é largo e suave ali: menos desenho por quadro)
    const step = fd(road[k].d) < 0.7 && k + 2 < road.length && road[k + 2].d - road[k].d <= 4 ? 2 : 1;
    const p = road[k], q = road[k + step];
    k += step - 1;
    if (fd(p.d) < 0) break;
    const f = fd(p.d), fq = Math.max(0, fd(q.d));
    // brilho caindo aos poucos até o fim do alcance (sem corte seco)
    const a = scale * Math.min(1, 1.2 * f ** 0.85);
    if (a <= 0.02) continue;
    // centro mais forte e bordas do trapézio mais fracas (três faixas sobrepostas)
    const wp = p.w * width(f), wq = q.w * width(fq);
    quad(cx, p.y + 0.5, cx, q.y - 0.5, wp, wq, a * 0.5);
    quad(cx, p.y + 0.5, cx, q.y - 0.5, wp * 0.7, wq * 0.7, a * 0.45);
    quad(cx, p.y + 0.5, cx, q.y - 0.5, wp * 0.42, wq * 0.42, a * 0.45);
  }
}

// luz de um poste: uma faixa de luz atravessando a pista inteira no trecho do poste (em degraus,
// mais forte embaixo da lâmpada), como nos jogos de corrida em pixel art; só o chão que se vê
const POOL = 8; // meia largura da faixa, em segmentos (os postes ficam a 14: as faixas se encontram)
function streetPool(g: CanvasRenderingContext2D, road: RoadPt[], st: Street, rgb: string, a0: number) {
  for (let k = 0; k + 1 < road.length; k++) {
    const p = road[k], q = road[k + 1];
    if (q.d - p.d > 2) continue; // entre os dois há chão escondido (crista)
    const dd = Math.abs((p.d + q.d) / 2 - st.d);
    if (dd > POOL) continue;
    const a = a0 * (dd <= 1.5 ? 1 : dd <= 3.5 ? 0.72 : dd <= 5.5 ? 0.48 : 0.3);
    // da outra borda da pista até um pouco além do poste
    const u0 = st.u > 0 ? -1.2 : st.u - 0.3, u1 = st.u > 0 ? st.u + 0.3 : 1.2;
    g.fillStyle = `${rgb}${a.toFixed(3)})`;
    g.beginPath();
    g.moveTo(p.x + p.w * u0, p.y + 0.5);
    g.lineTo(p.x + p.w * u1, p.y + 0.5);
    g.lineTo(q.x + q.w * u1, q.y - 0.5);
    g.lineTo(q.x + q.w * u0, q.y - 0.5);
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
    fronts.length = 0;
    refl.length = 0;
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
  reflectors(g, vp.x, top, 'rgba(0,0,0,', 1);
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
  reflectors(wg, vp.x, top, 'rgba(255,230,170,', 0.12 * strength); // tom quente do farol
  quantize(wg, W, H, 6);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.drawImage(warmCv, vp.x, top);
  c.imageSmoothingEnabled = prev;
  // a lâmpada de cada poste
  for (const st of streets) {
    // a lâmpada: um retângulo aceso nítido (como na arte) e um halo pequeno
    blob(c, st.x, st.head, Math.max(4, st.r * 0.26), Math.max(3, st.r * 0.14), '255,190,100', 0.5 * strength);
    blob(c, st.x, st.head, Math.max(2, st.r * 0.1), Math.max(1.5, st.r * 0.05), '255,230,170', 0.8 * strength);
    const lw = Math.max(2, Math.round(st.r * 0.09)), lh = Math.max(1, Math.round(st.r * 0.03));
    c.fillStyle = `rgba(255,244,210,${(0.95 * strength).toFixed(3)})`;
    c.fillRect(Math.round(st.x - lw / 2), Math.round(st.head - lh / 2), lw, lh);
  }
  refl.length = 0;
  facades(c, strength);
  streets.length = 0;
  // cada luz é desenhada numa camada à parte e recortada pela silhueta (pixel a pixel) dos carros
  // mais perto, que tapam o brilho dos de trás; vai do mais perto para o mais longe, juntando as
  // silhuetas numa máscara
  const tf = c.getTransform();
  const DW = c.canvas.width, DH = c.canvas.height;
  for (const cv of [occCv, tmpCv]) if (cv.width !== DW || cv.height !== DH) { cv.width = DW; cv.height = DH; }
  const oc = occCv.getContext('2d')!, lg = tmpCv.getContext('2d')!;
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.clearRect(0, 0, DW, DH);
  let occ = false;
  for (let li = lights.length - 1; li >= 0; li--) {
    const l = lights[li];
    const L = l.x - l.w / 2, T = l.y - l.h;
    // lâmpadas atrás de uma crista não aparecem (o carro está escondido pelo morro)
    const pts = l.dots.map(([u, f]) => [L + u * l.w, T + f * l.h]).filter(([, py]) => py <= l.clip + 1);
    if (pts.length) {
      // área da luz em pixels do canvas (o brilho e o clarão não passam de ~2 larguras do carro)
      const ext = l.w * (l.front ? 2.2 : 1.2) + 10;
      const x0 = Math.max(0, Math.floor(tf.a * (l.x - ext) + tf.e)), x1 = Math.min(DW, Math.ceil(tf.a * (l.x + ext) + tf.e));
      const y0 = Math.max(0, Math.floor(tf.d * (T - ext * 0.6) + tf.f)), y1 = Math.min(DH, Math.ceil(tf.d * (l.y + ext * 0.5) + tf.f));
      // só passa pela camada recortada se algum carro mais perto encosta nesta luz
      const masked = occ && lights.slice(li + 1).some((n) => n.shape && Math.abs(n.x - l.x) < ext + n.w / 2);
      const dc = masked ? lg : c;
      if (x1 > x0 && y1 > y0) {
        if (masked) {
          lg.setTransform(1, 0, 0, 1, 0, 0);
          lg.globalCompositeOperation = 'source-over';
          lg.clearRect(x0, y0, x1 - x0, y1 - y0);
          lg.setTransform(tf);
        }
        dc.save();
        // carro atrás de uma crista: só o que fica acima da linha da crista aparece
        if (l.clip < vp.y + vp.h) {
          dc.beginPath();
          dc.rect(vp.x, vp.y - 50, vp.w, l.clip + 1 - (vp.y - 50));
          dc.clip();
        }
        if (l.front) {
          // faróis de quem vem de frente: foco forte em cada farol, halo e o clarão na pista à frente
          const k = l.high ? 1.5 : 1;
          for (const [px, py] of pts) {
            blob(dc, px, py, Math.max(l.w * 0.55 * k, 5), Math.max(l.w * 0.4 * k, 3.5), '255,244,200', 0.75 * strength);
            blob(dc, px, py, Math.max(l.w * 0.16, 1.6), Math.max(l.w * 0.13, 1.3), '255,255,245', 1 * strength);
            // raios curtos (estrela) dos faróis vistos de frente
            dc.fillStyle = `rgba(255,250,225,${(0.5 * strength).toFixed(3)})`;
            dc.fillRect(px - l.w * 0.5 * k, py - 0.5, l.w * k, 1);
            dc.fillRect(px - 0.5, py - l.w * 0.18 * k, 1, l.w * 0.36 * k);
          }
          // clarão no asfalto entre o carro e o jogador
          blob(dc, l.x, l.y + l.w * 0.08, l.w * 1.3 * k, l.w * 0.26, '255,240,190', 0.38 * strength);
        } else {
          // lanternas: brilho vermelho em cada lâmpada; no freio fica bem mais forte, com halo
          // grande e o reflexo vermelho no asfalto atrás do carro
          // de longe a lâmpada continua um ponto vermelho bem visível (tamanho mínimo e mais forte),
          // como lanterna acesa na estrada escura
          const far = Math.max(0, Math.min(1, (24 - l.w) / 18)); // 1 = bem longe
          const m = (v: number, min: number) => Math.max(v, min * far);
          for (const [px, py] of pts) {
            if (l.brake) {
              blob(dc, px, py, m(l.w * 0.42, 5), m(l.w * 0.3, 3.5), '255,30,16', 0.32 * strength);
              blob(dc, px, py, m(l.w * 0.13, 1.8), m(l.w * 0.1, 1.5), '255,90,60', 0.85 * strength);
            } else {
              blob(dc, px, py, m(l.w * 0.2, 3.5), m(l.w * 0.14, 2.5), '255,36,20', (0.42 + 0.2 * far) * strength);
              blob(dc, px, py, m(l.w * 0.06, 1.4), m(l.w * 0.05, 1.2), '255,80,50', (0.6 + 0.35 * far) * strength);
            }
          }
          blob(dc, l.x, l.y + l.w * 0.03, l.w * (l.brake ? 0.85 : 0.6), l.w * 0.1, '255,30,16', (l.brake ? 0.28 : 0.12) * strength);
        }
        // luz da placa: fraca e amarelada, só se nota de perto
    if (l.plate && l.plate[2] >= 3) {
      const [px, py, pw, ph] = l.plate;
      const k = Math.min(1, (pw - 3) / 10);
      dc.fillStyle = `rgba(255,236,170,${(0.32 * k * strength).toFixed(3)})`;
      dc.fillRect(px, py, pw, ph);
      dc.fillStyle = `rgba(255,236,170,${(0.12 * k * strength).toFixed(3)})`;
      dc.fillRect(px - pw * 0.08, py - ph * 0.35, pw * 1.16, ph * 0.35);
    }
    // seta piscando: brilho âmbar do lado para onde vai
        if (l.signal && blinkOn()) {
          const [px, py] = pts[l.signal > 0 ? pts.length - 1 : 0] ?? [l.x, l.y - l.h / 2];
          const sx = l.front ? (l.signal > 0 ? L + l.w * 0.08 : L + l.w * 0.92) : px; // de frente o lado se inverte
          const far = Math.max(0, Math.min(1, (24 - l.w) / 18));
          blob(dc, sx, py, Math.max(l.w * 0.22, 4 * far), Math.max(l.w * 0.16, 3 * far), '255,160,30', (0.6 + 0.3 * far) * strength);
          blob(dc, sx, py, Math.max(l.w * 0.07, 1.5 * far), Math.max(l.w * 0.05, 1.2 * far), '255,215,120', (0.5 + 0.4 * far) * strength);
        }
        dc.restore();
        if (masked) {
          lg.setTransform(1, 0, 0, 1, 0, 0);
          lg.globalCompositeOperation = 'destination-out';
          lg.drawImage(occCv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
          c.save();
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.globalCompositeOperation = 'lighter';
          c.drawImage(tmpCv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
          c.restore();
        }
      }
    }
    // a silhueta deste carro passa a tapar as luzes dos que estão atrás dele
    // (só quando há luz de um carro de trás ao alcance dela)
    if (l.shape && lights.slice(0, li).some((n) => Math.abs(n.x - l.x) < n.w * (n.front ? 2.2 : 1.2) + 10 + l.w / 2)) {
      oc.setTransform(tf);
      oc.save();
      oc.beginPath();
      oc.rect(vp.x, vp.y - 50, vp.w, Math.min(vp.h + 100, l.clip + 1 - (vp.y - 50)));
      oc.clip();
      l.shape(oc);
      oc.restore();
      occ = true;
    }
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
