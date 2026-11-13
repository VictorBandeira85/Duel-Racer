// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean; clip: number; idx: number; shape?: (g: CanvasRenderingContext2D, game?: boolean) => void; plate?: number[] }
const lights: Light[] = [];
let collecting = false;

// postes de luz acesos (render3d registra cada um visível: lâmpada na tela, tamanho, trecho da
// pista onde está e posição lateral em meias larguras da pista a partir do centro)
// idx: segmento do poste no laço do desenho (objetos de segmentos mais perto tapam a luz dele)
interface Street { x: number; head: number; r: number; d: number; u: number; clip: number; ground: number; idx: number }
const streets: Street[] = [];
export function pushStreetLight(x: number, head: number, r: number, d: number, u: number, ground = Infinity, idx = -1) {
  if (collecting && r > 2) streets.push({ x, head, r: Math.min(r, 110), d, u, clip: clipY, ground, idx });
}
// linha da tela abaixo da qual o trecho sendo desenhado fica escondido (crista de morro à frente)
// e o índice desse trecho na pista (os objetos do cenário de trechos mais perto tapam as luzes dele)
let clipY = Infinity, clipIdx = Infinity;
export function setLightClip(y: number, idx = Infinity) {
  clipY = y;
  clipIdx = idx;
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
interface Reflector { kind: string; x: number; y: number; w: number; h: number; dist: number; clip: number; n: number }
const refl: Reflector[] = [];
export function pushReflector(kind: string, x: number, y: number, w: number, h: number, dist: number) {
  if (collecting && w > 1.5 && dist < 120) refl.push({ kind, x, y, w, h, dist, clip: clipY, n: lights.length });
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
    // os carros desenhados depois da placa (mais perto) tapam o brilho dela
    for (let j = r.n; j < lights.length; j++) {
      const n = lights[j];
      const L = n.x - ox - n.w / 2, T = n.y - oy - n.h;
      if (L > x + w || L + n.w < x - w || T > y || n.y - oy < y - h * 1.2) continue;
      g.beginPath();
      g.rect(x - w - 1, y - h * 1.2 - 1, w * 2 + 2, h * 1.2 + 2);
      g.rect(L, T, n.w, n.h);
      g.clip('evenodd');
    }
    // placas refletivas acendem mais que o papel dos outdoors
    const a = (r.kind === 'billboard' ? 0.75 : 0.95) * k * mul;
    g.fillStyle = `${rgb}${a.toFixed(3)})`;
    if (r.kind === 'billboard') g.fillRect(x - w / 2, y - h, w, h * 0.52);
    else if (r.kind === 'gasSign') g.fillRect(x - w / 2, y - h, w, h * 0.45);
    else if (r.kind === 'gasKm') g.fillRect(x - w / 2, y - h, w, h * 0.57);
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
  carBeams.length = 0;
  occluders.length = 0;
  refl.length = 0;
  fronts.length = 0;
  clipY = Infinity;
  clipIdx = Infinity;
  lights.length = 0;
  resetSils();
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
export function pushCarLights(x: number, y: number, w: number, look: CarLook, spots: { h: number; dots: number[][] }, shape?: (g: CanvasRenderingContext2D, game?: boolean) => void) {
  if (!collecting || !look.night || w < 1.5) return;
  lights.push({ x, y, w, h: spots.h, front: !!look.front, brake: !!look.brake, signal: look.signal ?? 0, dots: spots.dots, high: !!look.flash || !!look.lamps?.high, clip: clipY, idx: clipIdx, shape });
  lastLight = lights[lights.length - 1];
}
const blinkOn = () => Math.floor(performance.now() / 250) % 2 === 0;

// Escuridão e facho em pixels do jogo, em degraus chapados: o mesmo visual da pixel art, sem
// degradê liso. O facho é pintado sobre a própria pista, trecho a trecho da projeção (de perto
// para longe): acompanha as curvas e o relevo (subida: alcança mais alto na tela; topo de lombada:
// acaba ali, o que vem depois da crista não acende), acende o asfalto, as faixas, o acostamento e
// um pouco da beira, mais forte no centro e esmaecendo para os lados, e vira um pouco com o volante.
// z: distância contínua do ponto à câmera, em segmentos (o brilho cai pela distância sem saltar
// quando o carro passa de um segmento para o outro)
export interface RoadPt { d: number; x: number; y: number; w: number; z?: number; h?: number } // distância (segmentos), centro e linha na tela, meia largura da pista
let darkCv: HTMLCanvasElement | null = null;
const occCv = document.createElement('canvas'), tmpCv = document.createElement('canvas');
let occDirty = true;
let warmCv: HTMLCanvasElement | null = null;
const moonCv = document.createElement('canvas');
const REACH = 64; // alcance do farol, em segmentos (~90 m de chão iluminado)
// bordas do facho em meias larguras da pista: o miolo vai até o fim do acostamento (1,1) e a
// faixa mais fraca pega um pouco da beira
const EDGE_IN = 1.12, EDGE_OUT = 1.32;
// para onde o facho aponta: posição do carro na pista (meias larguras, do centro) e o volante
// (suavizado: no teclado ele vai de 0 a 1 de uma vez e o facho pularia)
let aimU = 0, aimSteer = 0;
// centro e meia largura do facho (em meias larguras da pista) a uma fração t do alcance (0 junto
// ao carro, 1 no fim): nasce estreito na frente do carro, na faixa dele, e abre com a distância
// até pegar a pista toda; longe o centro puxa um pouco para o meio da pista e para o lado do volante
function beamAt(t: number) {
  return { c: aimU * (1 - 0.3 * t) + aimSteer * 0.45 * t, hw: 0.55 + t };
}
// O farol é um cone preso ao carro: eixo um pouco abaixo da horizontal, inclinado com o carro
// (pitch: tangente da inclinação, subida > 0). Só acende o chão dentro dele: numa rampa à frente
// com o carro ainda no plano a pista sai pelo topo do cone no meio da subida (o facho acaba ali,
// numa linha, em vez de seguir a ladeira inteira); no ar ou depois de uma crista, a pista que cai
// abaixo do cone fica escura. ratio: altura do chão em relação ao farol / distância (tangente).
export const LAMP_H = 360; // altura do farol (unidades do mundo; os olhos do motorista ficam a 600)
const CONE_TOP = 0.03, CONE_SOFT = 0.06, CONE_LOW = -0.7; // topo do cone (um pouco acima do eixo: o farol espalha um pouco para cima), esmaecimento abaixo dele e o pé do cone
export function coneK(ratio: number, pitch: number) {
  const top = (pitch + CONE_TOP - ratio) / CONE_SOFT, low = (ratio - (pitch + CONE_LOW)) / 0.1;
  return Math.max(0, Math.min(1, top, low));
}
export const inCone = (ratio: number, pitch: number) => coneK(ratio, pitch) > 0.02;
let beamPitch = 0, beamSeg = 200;
// quanto do cone acende o ponto da pista (1 sem a altura: chão sem relevo conhecido)
const coneAt = (p: RoadPt) => p.h === undefined || p.z === undefined || p.z <= 0.5 ? 1 : coneK(p.h / (p.z * beamSeg), beamPitch);
// brilho a uma fração t do alcance: caindo aos poucos até o fim (sem corte seco)
const beamFall = (t: number) => Math.min(1, 1.2 * Math.max(0, 1 - t) ** 0.85);
// a escuridão e as luzes são polígonos de brilho chapado (degraus da pixel art) desenhados direto,
// sem reprocessar os pixels a cada quadro
// trecho contínuo de chão à frente do carro: para na crista (o que vem depois do topo da subida
// está escondido; a luz que passa da crista vai para o ar e não aparece em nada)
function groundAhead(road: RoadPt[]) {
  let n = 0;
  while (n + 1 < road.length && road[n + 1].d - road[n].d <= 2) n++;
  return road.slice(0, n + 1);
}
// onde começa a contar o alcance: o chão que aparece acima do capô/painel (num carro de painel
// alto o trecho perto fica escondido e o facho continua aparecendo à frente)
function beamZ0(road: RoadPt[], seen: number) {
  const p = road.find((q) => q.y < seen - 1);
  return Math.max(0, (p ? p.z ?? p.d : 0) - 6);
}
const BANDS = [[1, EDGE_OUT, 0.5], [0.68, EDGE_IN, 0.45], [0.4, EDGE_IN, 0.45]]; // largura relativa, borda, peso
const LEVELS = 20; // degraus de brilho ao longo do facho (trechos vizinhos no mesmo degrau viram um polígono só)
// pinta o facho (alpha) em g sobre o chão à frente
function beamShape(g: CanvasRenderingContext2D, w: number, cx: number, seen: number, road: RoadPt[], scale: number) {
  if (!road.length) return;
  g.save();
  // só o chão à frente: o que aparece pelas janelas laterais, abaixo da linha do painel, fica ao
  // lado do carro, fora do facho
  g.beginPath();
  g.rect(0, 0, w, seen + 6);
  g.clip();
  const z0 = beamZ0(road, seen);
  const tOf = (p: RoadPt) => Math.max(0, ((p.z ?? p.d) - z0) / REACH);
  // pontos do caminho (de perto para longe): longe, dois ou três trechos por vez (o facho é largo e
  // suave ali: menos desenho por quadro)
  const pts: RoadPt[] = [];
  for (let k = 0; k < road.length;) {
    const p = road[k];
    pts.push(p);
    if (tOf(p) >= 1) break;
    const f = 1 - tOf(p);
    const step = f < 0.4 && k + 3 < road.length && road[k + 3].d - p.d <= 6 ? 3 : f < 0.75 && k + 2 < road.length && road[k + 2].d - p.d <= 4 ? 2 : 1;
    k += step;
  }
  // brilho de cada trecho (pelo meio dele), em degraus
  const lv: number[] = [];
  // (vezes o cone do farol: a pista fora dele não acende)
  const cone = pts.map(coneAt);
  for (let k = 0; k + 1 < pts.length; k++) lv.push(Math.round(beamFall((tOf(pts[k]) + tOf(pts[k + 1])) / 2) * Math.min(cone[k], cone[k + 1]) * LEVELS));
  for (const [rel, edge, wt] of BANDS) {
    // bordas da faixa de luz em cada ponto, recortadas na borda da pista
    const xl: number[] = [], xr: number[] = [];
    for (const p of pts) {
      const { c, hw } = beamAt(tOf(p));
      const lo = Math.max(-edge, c - hw * rel), hi = Math.max(lo, Math.min(edge, c + hw * rel));
      xl.push(p.x + lo * p.w);
      xr.push(p.x + hi * p.w);
    }
    // perto do carro, abaixo do primeiro trecho de pista: continua o facho até o painel, centrado no carro
    const p0 = pts[0], m0 = (xl[0] + xr[0]) / 2;
    const fill = (a: number, ls: number[][], rs: number[][]) => {
      g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
      g.beginPath();
      g.moveTo(ls[0][0], ls[0][1]);
      for (let i = 1; i < ls.length; i++) g.lineTo(ls[i][0], ls[i][1]);
      for (let i = rs.length - 1; i >= 0; i--) g.lineTo(rs[i][0], rs[i][1]);
      g.closePath();
      g.fill();
    };
    fill(scale * wt * beamFall(tOf(p0)) * cone[0], [[cx + (xl[0] - m0) * 0.85, seen + 6], [xl[0], p0.y + 0.5]], [[cx + (xr[0] - m0) * 0.85, seen + 6], [xr[0], p0.y + 0.5]]);
    // trechos vizinhos com o mesmo degrau de brilho: um polígono só, seguindo a curva da pista
    let ls: number[][] = [], rs: number[][] = [], cur = -1;
    for (let k = 0; k + 1 < pts.length; k++) {
      if (lv[k] !== cur) {
        if (cur > 0 && ls.length > 1) fill(scale * wt * cur / LEVELS, ls, rs);
        cur = lv[k];
        // (os degraus encostam um no outro na mesma linha, sem sobrepor: nada de risco claro)
        const y = pts[k].y + (k ? 0 : 0.5);
        ls = [[xl[k], y]];
        rs = [[xr[k], y]];
      }
      ls.push([xl[k + 1], pts[k + 1].y]);
      rs.push([xr[k + 1], pts[k + 1].y]);
    }
    if (cur > 0 && ls.length > 1) fill(scale * wt * cur / LEVELS, ls, rs);
  }
  g.restore();
}

// luz de um poste: uma faixa de luz atravessando a pista inteira no trecho do poste (em degraus,
// mais forte embaixo da lâmpada), como nos jogos de corrida em pixel art; só o chão que se vê
const POOL = 6; // meia largura da faixa, em segmentos (luz concentrada embaixo do poste, sem virar névoa)
function streetPool(g: CanvasRenderingContext2D, road: RoadPt[], st: Street, rgb: string, a0: number) {
  for (let k = 0; k + 1 < road.length; k++) {
    const p = road[k], q = road[k + 1];
    if (q.d - p.d > 2) continue; // entre os dois há chão escondido (crista)
    const dd = Math.abs((p.d + q.d) / 2 - st.d);
    if (dd > POOL) continue;
    const a = a0 * (dd <= 1 ? 1 : dd <= 2 ? 0.8 : dd <= 3.5 ? 0.55 : dd <= 5 ? 0.32 : 0.15);
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
// brilho redondo: desenhado uma vez por cor num quadrado de 64 px e depois só ampliado e
// esticado (criar um degradê por luz a cada quadro pesava na placa de vídeo integrada)
const blobSprites = new Map<string, HTMLCanvasElement>();
function blobSprite(rgb: string) {
  let cv = blobSprites.get(rgb);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.35, `rgba(${rgb},0.45)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    blobSprites.set(rgb, cv);
  }
  return cv;
}
function blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: string, a: number) {
  if (rx < 0.5 || a <= 0.01) return;
  const ga = c.globalAlpha;
  c.globalAlpha = ga * Math.min(1, a);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  c.drawImage(blobSprite(rgb), x - rx, y - ry, rx * 2, ry * 2);
  c.imageSmoothingEnabled = sm;
  c.globalAlpha = ga;
}

// farol dos outros carros: a mancha de luz no asfalto à frente de cada um, na faixa dele.
// p: o caminho do facho na tela, do para-choque para a frente, de trecho em trecho da pista
// (x, y, meia largura, x, y, meia largura, ...): acompanha a curva e o relevo entre o carro e o fim
// da luz (antes era um quadrilátero reto, que numa curva atravessava todas as faixas). Vale para
// quem vai à frente (o facho sobe na tela) e para quem vem de frente (o facho desce, vindo para nós).
// end: índice do último segmento da pista que tapa a luz (objetos até ali apagam o facho)
interface Beam { p: number[]; clip: number; end: number; k: number }
const carBeams: Beam[] = [];
// k: intensidade (0..1) — de longe o facho entra aos poucos, sem aparecer de repente
export function pushCarBeam(p: number[], clip: number, end = Infinity, k = 1) {
  if (collecting && k > 0.01 && p.length >= 6) carBeams.push({ p, clip, end, k });
}
// objetos do cenário (árvores, viadutos, placas, prédios...) com o índice do segmento: tapam o
// facho dos carros de trás deles
interface Occ { cv: CanvasImageSource; x: number; y: number; w: number; h: number; idx: number; clip: number }
const occluders: Occ[] = [];
export function pushOccluder(o: Occ) {
  if (collecting) occluders.push(o);
}
function drawCarBeamsWarm(g: CanvasRenderingContext2D, ox: number, oy: number, a: number, list: Beam[] = carBeams) {
  const SPILL = `rgba(255,226,160,${(a * 0.7).toFixed(3)})`;
  for (const b of list) {
    const p = b.p, n = p.length / 3;
    const y0 = p[1], yn = p[p.length - 2];
    // um polígono só por facho (as duas bordas seguindo a pista) com o brilho caindo pelo
    // caminho: começa suave junto ao para-choque, chega ao máximo logo adiante e vai sumindo
    const grad = g.createLinearGradient(0, y0 - oy, 0, yn - oy);
    grad.addColorStop(0, `rgba(255,226,160,${Math.min(1, a * 0.35).toFixed(3)})`);
    grad.addColorStop(0.2, `rgba(255,226,160,${Math.min(1, a).toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(255,226,160,${Math.min(1, a * 0.7).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,226,160,0)');
    // (o caminho já para onde a pista some atrás de uma crista: não precisa de recorte)
    g.save();
    g.globalAlpha = b.k;
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = p[i * 3] - p[i * 3 + 2] - ox, y = p[i * 3 + 1] - oy;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) g.lineTo(p[i * 3] + p[i * 3 + 2] - ox, p[i * 3 + 1] - oy);
    g.closePath();
    g.fill();
    g.restore();
    // clarão logo à frente do carro: o brilho do farol no ar e no chão junto ao para-choque.
    // Mesmo com a estrada adiante escondida (curva, lombada) a claridade aparece, fraca de longe e
    // crescendo com a aproximação; só não passa da crista que esconde o próprio carro (clip)
    const mx = p[0] - ox, hw = Math.max(9, p[2] * 2.2), my = y0 - oy - Math.max(1.5, Math.abs(y0 - yn) * 0.12) * Math.sign(y0 - yn || 1);
    const rg = g.createRadialGradient(mx, my, 0, mx, my, hw);
    rg.addColorStop(0, SPILL);
    rg.addColorStop(1, SPILL.replace(/[\d.]+\)$/, '0)'));
    g.save();
    g.globalAlpha = b.k;
    if (b.clip < Infinity) {
      g.beginPath();
      g.rect(0, 0, g.canvas.width, b.clip - oy + 1);
      g.clip();
    }
    g.fillStyle = rg;
    g.translate(mx, my);
    g.scale(1, 0.45);
    g.translate(-mx, -my);
    g.fillRect(mx - hw, my - hw, hw * 2, hw * 2);
    g.restore();
  }
}
// camada de luz secundária: desenha (draw) e apaga as silhuetas de todos os carros registrados
const secCv = document.createElement('canvas');
const carCv = document.createElement('canvas');
// quanto cada carro está iluminado (0..1): nosso farol pela distância e posição na tela, mais a
// luz de um poste perto do trecho dele
function carLighting(rd: RoadPt[], ground: RoadPt[], seen: number, top: number, ox: number) {
  const z0 = beamZ0(ground, seen);
  const lastD = ground.length ? ground[ground.length - 1].d : -1;
  return (l: Light) => {
    const y = l.y - top;
    let best: RoadPt | null = null;
    for (const p of rd) if (!best || Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
    if (!best) return 0;
    let lit = 0;
    // o mesmo facho que acende a pista: só no chão à frente que se vê (atrás da crista não chega),
    // pela distância e pela posição do carro na pista em relação ao facho
    const t = Math.max(0, ((best.z ?? best.d) - z0) / REACH);
    if (best.d <= lastD && t < 1 && best.w > 0) {
      const { c, hw } = beamAt(t);
      const u = (l.x - ox - best.x) / best.w, half = l.w / 2 / best.w;
      if (u + half > Math.max(-EDGE_OUT, c - hw) && u - half < Math.min(EDGE_OUT, c + hw)) lit = 0.9 * beamFall(t) * coneAt(best);
    }
    for (const st of streets) {
      const dd = Math.abs(best.d - st.d);
      if (dd <= POOL) lit += 0.7 * (dd <= 1 ? 1 : dd <= 2 ? 0.8 : dd <= 3.5 ? 0.55 : dd <= 5 ? 0.32 : 0.15);
    }
    return Math.min(1, lit);
  };
}
// silhueta de cada carro, recortada uma vez por quadro (as duas camadas, escura e quente, usam a
// mesma: antes cada camada redesenhava o carro inteiro só para pegar o contorno)
// silhuetas dos carros: todas num canvas só (atlas, em prateleiras), em vez de um canvas por carro
interface Sil { cv: HTMLCanvasElement; sx: number; sy: number; x0: number; y0: number; w: number; h: number }
const silAtlas = document.createElement('canvas');
let silX = 0, silY = 0, silRow = 0;
const sils = new Map<Light, Sil | null>();
function resetSils() {
  silX = silY = silRow = 0;
  silAllOk = false;
  sils.clear();
}
function silhouette(l: Light, W: number, H: number, ox: number, oy: number): Sil | null {
  const hit = sils.get(l);
  if (hit !== undefined) return hit;
  const x0 = Math.max(0, Math.floor(l.x - l.w * 0.75 - ox)), x1 = Math.min(W, Math.ceil(l.x + l.w * 0.75 - ox));
  // 1,8 larguras de altura: o baú do caminhão é bem mais alto que um carro
  const y0 = Math.max(0, Math.floor(l.y - l.w * 1.8 - oy)), y1 = Math.min(H, Math.ceil(l.y + l.w * 0.2 + 2 - oy), Math.ceil(Math.max(l.clip + 1, l.clip >= l.y - 1 ? l.y + l.w * 0.2 + 2 : 0) - oy));
  if (!l.shape || x1 <= x0 || y1 <= y0) {
    sils.set(l, null);
    return null;
  }
  const w = x1 - x0, h = y1 - y0;
  const AW = Math.max(512, W * 2), AH = Math.max(256, H * 2);
  if (silAtlas.width !== AW || silAtlas.height !== AH) { silAtlas.width = AW; silAtlas.height = AH; }
  if (silX + w > AW) { silX = 0; silY += silRow + 1; silRow = 0; }
  if (silY + h > AH || w > AW) { sils.set(l, null); return null; } // atlas cheio (muitos carros enormes): este fica sem sombra própria
  const sx = silX, sy = silY, cv = silAtlas;
  silX += w + 1;
  silRow = Math.max(silRow, h);
  const t = cv.getContext('2d')!;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.clearRect(sx, sy, w + 1, h + 1);
  t.save();
  t.beginPath();
  t.rect(sx, sy, w, h);
  t.clip();
  t.translate(sx - ox - x0, sy - oy - y0);
  l.shape(t, true);
  t.restore();
  const sl = { cv, sx, sy, x0, y0, w, h };
  sils.set(l, sl);
  return sl;
}
// apaga a silhueta de cada carro da camada e pinta de novo com uma cor por inteiro (rgb, com a
// opacidade de cada carro em alpha). Em lote: todas as silhuetas vão para uma máscara só (silAll,
// feita uma vez por quadro) e as opacidades para outra (carCv), e a camada recebe as duas de uma vez.
// Antes era um vaivém de canvas por carro, por camada: pesava à noite com trânsito.
const silAllCv = document.createElement('canvas');
let silAllOk = false;
function shadeCars(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, rgb: string, alpha: (l: Light) => number) {
  const list = lights.filter((n) => n.shape).sort((a, b) => a.y - b.y); // do mais longe para o mais perto
  const sl = list.map((l) => silhouette(l, W, H, ox, oy));
  if (!sl.some(Boolean)) { g.globalCompositeOperation = 'destination-out'; return; }
  for (const cv of [silAllCv, carCv]) if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; silAllOk = false; }
  if (!silAllOk) {
    const a = silAllCv.getContext('2d')!;
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'source-over';
    a.clearRect(0, 0, W, H);
    for (const q of sl) if (q) a.drawImage(q.cv, q.sx, q.sy, q.w, q.h, q.x0, q.y0, q.w, q.h);
    silAllOk = true;
  }
  const t = carCv.getContext('2d')!;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, W, H);
  list.forEach((l, i) => {
    const q = sl[i];
    if (!q) return;
    // o da frente cobre o de trás: tira o que havia sob a silhueta e põe a opacidade deste carro
    t.globalCompositeOperation = 'destination-out';
    t.globalAlpha = 1;
    t.drawImage(q.cv, q.sx, q.sy, q.w, q.h, q.x0, q.y0, q.w, q.h);
    t.globalCompositeOperation = 'source-over';
    t.globalAlpha = Math.max(0, Math.min(1, alpha(l)));
    t.drawImage(q.cv, q.sx, q.sy, q.w, q.h, q.x0, q.y0, q.w, q.h);
  });
  t.globalAlpha = 1;
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = rgb;
  t.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(silAllCv, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(carCv, 0, 0);
  // quem chamou continua no modo em que estava (a camada escura segue recortando)
  g.globalCompositeOperation = 'destination-out';
}
const beamCv = document.createElement('canvas');
// faixas de luz dos postes, recortadas pelos objetos do cenário mais perto que cada poste (outdoor,
// placa, árvore na frente do trecho iluminado não ficam pintados de luz). Tudo na própria camada, do
// mais longe para o mais perto: cada objeto apaga a luz dos postes que estão atrás dele (já pintados)
// e os postes mais perto são pintados depois. (Antes: um rascunho de tela inteira por poste.)
function maskedPools(s: CanvasRenderingContext2D, W: number, oy: number, ox: number, rd: RoadPt[], a0: number) {
  const free = streets.filter((st) => st.idx < 0), far = streets.filter((st) => st.idx >= 0).sort((a, b) => b.idx - a.idx);
  if (!far.length) { for (const st of free) streetPool(s, rd, st, 'rgba(255,190,90,', a0); return; }
  const occ = occluders.filter((o) => o.idx < far[0].idx).sort((a, b) => b.idx - a.idx);
  let k = 0;
  for (const st of far) {
    // objetos com idx >= ao do poste não o tapam, mas tapam os que já foram pintados (mais longe)
    for (; k < occ.length && occ[k].idx >= st.idx; k++) erasePool(s, W, ox, oy, occ[k]);
    s.globalCompositeOperation = 'source-over';
    streetPool(s, rd, st, 'rgba(255,190,90,', a0);
  }
  for (; k < occ.length; k++) erasePool(s, W, ox, oy, occ[k]);
  s.globalCompositeOperation = 'source-over';
  for (const st of free) streetPool(s, rd, st, 'rgba(255,190,90,', a0); // sem posição na pista: nada os tapa
}
function erasePool(s: CanvasRenderingContext2D, W: number, ox: number, oy: number, o: Occ) {
  s.globalCompositeOperation = 'destination-out';
  s.save();
  s.beginPath();
  s.rect(0, 0, W, Math.max(0, o.clip - oy + 1));
  s.clip();
  s.drawImage(o.cv, o.x - ox, o.y - oy, o.w, o.h);
  s.restore();
}
function secondary(W: number, H: number, ox: number, oy: number, draw: (s: CanvasRenderingContext2D) => void, beam?: (g: CanvasRenderingContext2D, b: Beam) => void) {
  if (!streets.length && !carBeams.length) return null;
  if (secCv.width !== W || secCv.height !== H) {
    secCv.width = W;
    secCv.height = H;
  }
  const s = secCv.getContext('2d')!;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, W, H);
  draw(s);
  // os fachos de todos os carros num rascunho só, em lote (antes era um rascunho por facho, e com
  // os carros vindo de frente também com facho a troca de canvas dobrava): do facho que vai mais
  // longe para o mais curto; antes de cada um, os objetos do cenário que ficam além do alcance dele
  // (mas na frente dos já pintados) apagam a luz onde a tapam; no fim, os mais perto apagam todos
  if (beam && carBeams.length) {
    if (beamCv.width !== W || beamCv.height !== H) {
      beamCv.width = W;
      beamCv.height = H;
    }
    const t = beamCv.getContext('2d')!;
    // caixa de todos os fachos juntos (com folga para o clarão junto ao para-choque)
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const b of carBeams) {
      const hw = Math.max(10, b.p[2] * 2.3);
      for (let i = 0; i < b.p.length; i += 3) {
        bx0 = Math.min(bx0, b.p[i] - b.p[i + 2] - hw);
        bx1 = Math.max(bx1, b.p[i] + b.p[i + 2] + hw);
        by0 = Math.min(by0, b.p[i + 1] - hw);
        by1 = Math.max(by1, b.p[i + 1] + hw);
      }
    }
    const x0 = Math.max(0, Math.floor(bx0 - ox)), x1 = Math.min(W, Math.ceil(bx1 - ox));
    const y0 = Math.max(0, Math.floor(by0 - oy)), y1 = Math.min(H, Math.ceil(by1 - oy));
    if (x1 > x0 && y1 > y0) {
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = 'source-over';
      t.clearRect(x0, y0, x1 - x0, y1 - y0);
      const list = carBeams.slice().sort((p, q) => q.end - p.end);
      const occ = occluders.filter((o) => o.idx <= list[0].end && !(o.x - ox > x1 || o.x + o.w - ox < x0 || o.y - oy > y1 || o.y + o.h - oy < y0)).sort((p, q) => q.idx - p.idx);
      let k = 0;
      const erase = (o: Occ) => {
        t.globalCompositeOperation = 'destination-out';
        t.save();
        t.beginPath();
        t.rect(x0, y0, x1 - x0, Math.max(0, Math.min(y1, o.clip - oy + 1) - y0));
        t.clip();
        t.drawImage(o.cv, o.x - ox, o.y - oy, o.w, o.h);
        t.restore();
      };
      for (const b of list) {
        for (; k < occ.length && occ[k].idx > b.end; k++) erase(occ[k]);
        t.globalCompositeOperation = 'source-over';
        // o facho só ilumina a pista (com um pouco do acostamento): não passa por paredes de
        // túnel, guard-rails, outdoors e o cenário ao lado
        if (roadPoly.length > 1) {
          t.save();
          t.beginPath();
          for (let i = 0; i < roadPoly.length; i++) {
            const q = roadPoly[i];
            if (i) t.lineTo(q.x - q.w * 1.25 - ox, q.y - oy);
            else t.moveTo(q.x - q.w * 1.25 - ox, q.y + 2 - oy);
          }
          for (let i = roadPoly.length - 1; i >= 0; i--) {
            const q = roadPoly[i];
            t.lineTo(q.x + q.w * 1.25 - ox, q.y + (i ? 0 : 2) - oy);
          }
          t.closePath();
          t.clip();
          beam(t, b);
          t.restore();
        } else beam(t, b);
      }
      for (; k < occ.length; k++) erase(occ[k]);
      t.globalCompositeOperation = 'source-over';
      s.drawImage(beamCv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
  }
  s.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    if (!l.shape) continue;
    s.save();
    s.translate(-ox, -oy);
    s.beginPath();
    s.rect(ox, oy - 60, W, Math.max(0, l.clip + 1 - (oy - 60)));
    s.clip();
    l.shape(s, true);
    s.restore();
  }
  s.globalCompositeOperation = 'source-over';
  return secCv;
}
// luar no asfalto: fora do facho a pista não fica um breu; a escuridão fica um pouco mais rala
// sobre o asfalto e o acostamento (as faixas e a borda continuam se vendo de leve), bem menos que o
// farol. Feito num rascunho do qual saem os objetos do cenário (tudo o que encobre a pista na tela
// está na frente dela), para o luar não passar por cima de pedras, árvores e placas.
const MOON_ROAD = 0.17;
function moonRoad(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number) {
  if (roadPoly.length < 2) return;
  if (beamCv.width !== W || beamCv.height !== H) { beamCv.width = W; beamCv.height = H; }
  const t = beamCv.getContext('2d')!;
  let y0 = H;
  for (const q of roadPoly) y0 = Math.min(y0, q.y - oy);
  y0 = Math.max(0, Math.floor(y0) - 1);
  if (y0 >= H) return;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, y0, W, H - y0);
  t.fillStyle = `rgba(0,0,0,${MOON_ROAD})`;
  // um polígono por trecho contínuo de pista visível (entre dois trechos há chão escondido atrás
  // de uma crista, que não pode clarear)
  for (let a = 0; a < roadPoly.length;) {
    let b = a;
    while (b + 1 < roadPoly.length && roadPoly[b + 1].d - roadPoly[b].d <= 2) b++;
    if (b > a) {
      t.beginPath();
      for (let i = a; i <= b; i++) {
        const q = roadPoly[i];
        if (i > a) t.lineTo(q.x - q.w * 1.1 - ox, q.y - oy);
        else t.moveTo(q.x - q.w * 1.1 - ox, Math.min(H, q.y - oy + (a ? 0 : H)));
      }
      for (let i = b; i >= a; i--) {
        const q = roadPoly[i];
        t.lineTo(q.x + q.w * 1.1 - ox, Math.min(H, q.y - oy + (i === a && !a ? H : 0)));
      }
      t.closePath();
      t.fill();
    }
    a = b + 1;
  }
  t.globalCompositeOperation = 'destination-out';
  for (const o of occluders) {
    if (o.y + o.h - oy < y0) continue;
    // só os objetos que encostam na pista na tela (árvores e pedras da beira, ao lado do asfalto,
    // não precisam ser recortadas): largura da pista nas linhas que o objeto ocupa
    let lo = Infinity, hi = -Infinity;
    for (const q of roadPoly) if (q.y >= o.y - 2 && q.y <= o.y + o.h + 2) { lo = Math.min(lo, q.x - q.w * 1.1); hi = Math.max(hi, q.x + q.w * 1.1); }
    if (o.x > hi || o.x + o.w < lo) continue;
    t.save();
    t.beginPath();
    t.rect(0, y0, W, Math.max(0, o.clip - oy + 1 - y0));
    t.clip();
    t.drawImage(o.cv, o.x - ox, o.y - oy, o.w, o.h);
    t.restore();
  }
  t.globalCompositeOperation = 'source-over';
  g.drawImage(beamCv, 0, y0, W, H - y0, 0, y0, W, H - y0);
}
export interface Pass { x: number; dz: number } // quem vem atrás com farol aceso (dz > 0 atrás)

// fim da pista: escuridão, luzes dos carros somadas e a claridade de quem emparelha
// lua (ou outra luz do céu) que não deve ser apagada pela escuridão da noite
let sky: { x: number; y: number; r: number; floor: number; ridge?: { x0: number; ys: number[] } } | null = null;
// floor: linha da tela abaixo da qual o furo de luz não passa (os morros e o chão ficam escuros);
// ridge: a linha dos morros coluna a coluna (o furo fica só no céu acima dela)
export function setSkyLight(x: number, y: number, r: number, floor = Infinity, ridge?: { x0: number; ys: number[] }) {
  sky = { x, y, r, floor, ridge };
}
let roadPoly: RoadPt[] = [];
export function finishNight(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number; horizon: number; dash?: number }, strength: number, passers: Pass[], segLen: number, road: RoadPt[] = [], roadAll: RoadPt[] = road, steer = 0, pitch = 0) {
  collecting = false;
  roadPoly = roadAll;
  if (strength <= 0.02) {
    sky = null;
    carBeams.length = 0;
    occluders.length = 0;
    streets.length = 0;
    fronts.length = 0;
    refl.length = 0;
    return;
  }
  const top = Math.max(vp.y, Math.floor(vp.horizon) - 60);
  const W = Math.max(1, Math.round(vp.w)), H = Math.max(1, Math.round(vp.y + vp.h - top));
  const bot = vp.y + vp.h, seen = Math.min(bot, vp.dash ?? bot);
  const cx = W / 2;
  const rd = road.map((p) => ({ ...p, x: p.x - vp.x, y: p.y - top }));
  // camada da escuridão (pixels do jogo), com o facho recortado
  darkCv = darkCv ?? document.createElement('canvas');
  if (darkCv.width !== W || darkCv.height !== H) {
    darkCv.width = W;
    darkCv.height = H;
  }
  const g = darkCv.getContext('2d')!;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.fillStyle = `rgba(0,0,10,${(0.8 * strength).toFixed(3)})`;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  const ground = groundAhead(rd);
  // o facho sai do carro: a posição dele na pista vem do trecho mais perto (centro da tela)
  if (ground.length && ground[0].w > 0) aimU = Math.max(-3, Math.min(3, (cx - ground[0].x) / ground[0].w));
  aimSteer += (Math.max(-1, Math.min(1, steer)) - aimSteer) * 0.2;
  beamPitch = pitch;
  beamSeg = segLen;
  beamShape(g, W, cx, seen - top, ground, 0.9);
  reflectors(g, vp.x, top, 'rgba(0,0,0,', 1);
  // postes acesos e faróis de quem vai à frente: luz só no chão, numa camada à parte da qual as
  // silhuetas dos carros são apagadas (a mancha de luz não passa por cima de nenhum carro)
  // UMA camada só para as duas coisas: a luz quente (sódio dos postes e farol de quem vai à frente,
  // já recortada pelos objetos e sem os carros) é feita aqui e serve também para abrir a escuridão:
  // quatro passadas dela apagando o escuro dão o mesmo clarão de antes (postes ~0,6, faróis ~1) sem
  // montar uma segunda camada igual, que era o que mais pesava à noite
  const secW = secondary(W, H, vp.x, top, (s) => {
    maskedPools(s, W, top, vp.x, rd, 0.2 * strength);
  }, (t, b) => drawCarBeamsWarm(t, vp.x, top, 0.935 * strength, [b]));
  if (secW) for (let i = 0; i < 4; i++) g.drawImage(secW, 0, 0);
  moonRoad(g, W, H, vp.x, top);
  // cada carro com uma luz só no corpo inteiro (o facho ou a luz do poste não cortam a
  // carroceria ao meio): conforme a distância no nosso farol e a proximidade de um poste
  // clarão da lua no céu: antes dos carros (um carro na frente da lua tapa o clarão)
  if (sky) {
    // o furo da lua é feito num rascunho do tamanho do clarão: dele saem os objetos do cenário
    // (pedras, árvores, paredões, placas) que ficam na frente do céu, e só então ele abre a
    // escuridão (antes o clarão da lua clareava por cima deles)
    const R = Math.ceil(sky.r) + 1;
    const sx = sky.x - vp.x, sy = sky.y - top, ex = Math.floor(sx) - R, ey = Math.floor(sy) - R;
    if (moonCv.width !== R * 2 + 2) { moonCv.width = moonCv.height = R * 2 + 2; }
    const mg = moonCv.getContext('2d')!;
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, moonCv.width, moonCv.height);
    mg.translate(-ex, -ey); // mesmas coordenadas da camada escura
    const sg = mg.createRadialGradient(sx, sy, 0, sx, sy, sky.r);
    sg.addColorStop(0, 'rgba(0,0,0,1)');
    sg.addColorStop(0.4, 'rgba(0,0,0,0.8)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = sg;
    mg.save();
    if (sky.ridge) {
      // só acima dos morros e da pista (a pista numa subida passa por cima do horizonte)
      const { x0, ys } = sky.ridge;
      // só os pedaços da pista que se veem (atrás de uma crista a pista projeta mais alto, mas
      // está escondida pelo morro): de perto para longe, cada ponto só conta se sobe na tela
      const vis: RoadPt[] = [];
      let lowest = Infinity;
      for (const p of [...rd].sort((a, b) => a.d - b.d)) if (p.y < lowest) { lowest = p.y; vis.push(p); }
      mg.beginPath();
      mg.moveTo(x0 - vp.x, -1);
      ys.forEach((y, i) => {
        const cx0 = x0 + i - vp.x;
        let fy = Math.min(y, sky!.floor) - top;
        for (const p of vis) if (Math.abs(cx0 - p.x) <= p.w * 1.3 + 2) fy = Math.min(fy, p.y - 2);
        mg.lineTo(cx0, fy);
        mg.lineTo(cx0 + 1, fy);
      });
      mg.lineTo(x0 + ys.length - vp.x, -1);
      mg.closePath();
      mg.clip();
    }
    mg.fillRect(sx - sky.r, sy - sky.r, sky.r * 2, Math.min(sky.r * 2, sky.floor - top - (sy - sky.r)));
    mg.restore();
    mg.globalCompositeOperation = 'destination-out';
    for (const o of occluders) {
      const ox0 = o.x - vp.x, oy0 = o.y - top;
      if (ox0 > ex + R * 2 + 2 || ox0 + o.w < ex || oy0 > ey + R * 2 + 2 || oy0 + o.h < ey) continue;
      mg.save();
      mg.beginPath();
      mg.rect(ex, ey, R * 2 + 2, Math.max(0, o.clip - top + 1 - ey));
      mg.clip();
      mg.drawImage(o.cv, ox0, oy0, o.w, o.h);
      mg.restore();
    }
    g.drawImage(moonCv, ex, ey);
    sky = null;
  }
  const litOf = carLighting(rd, ground, seen - top, top, vp.x);
  shadeCars(g, W, H, vp.x, top, 'rgb(0,0,10)', (l) => 0.8 * strength * (1 - 0.68 * litOf(l)));
  g.globalCompositeOperation = 'source-over';
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(darkCv, vp.x, top);
  // luz amarelada somada no chão iluminado (o asfalto da noite é escuro: só recortar não basta)
  warmCv = warmCv ?? document.createElement('canvas');
  if (warmCv.width !== W || warmCv.height !== H) {
    warmCv.width = W;
    warmCv.height = H;
  }
  const wg = warmCv.getContext('2d')!;
  wg.globalCompositeOperation = 'source-over';
  wg.clearRect(0, 0, W, H);
  beamShape(wg, W, cx, seen - top, ground, 0.3);
  wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = 'rgb(255,226,160)';
  wg.fillRect(0, 0, W, H);
  wg.globalCompositeOperation = 'source-over';
  reflectors(wg, vp.x, top, 'rgba(255,230,170,', 0.12 * strength); // tom quente do farol
  // luz de sódio dos postes e farol de quem vai à frente, sem pintar os carros
  if (secW) wg.drawImage(secW, 0, 0);
  // apaga o facho e a luz do poste pintados no chão por baixo de cada carro (no baú alto do
  // caminhão eles apareciam em degraus) e dá ao carro inteiro uma luz só
  shadeCars(wg, W, H, vp.x, top, 'rgb(255,226,160)', (l) => 0.1 * litOf(l));
  wg.globalCompositeOperation = 'source-over';
  carBeams.length = 0;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = Math.min(1, strength); // no lusco-fusco a luz do farol ainda quase não aparece
  // a luz quente só existe do topo da pista visível para baixo (chão, carros e placas): o resto
  // da camada é vazio e não precisa ser somado à tela
  let wy = rd.length ? Math.min(...rd.map((p) => p.y)) - 70 : 0;
  for (const f of refl) wy = Math.min(wy, f.y - f.h - top - 4);
  for (const l of lights) wy = Math.min(wy, l.y - l.w * 1.4 - top - 4);
  wy = Math.max(0, Math.floor(wy));
  if (wy < H) c.drawImage(warmCv, 0, wy, W, H - wy, vp.x, top + wy, W, H - wy);
  c.globalAlpha = 1;
  c.imageSmoothingEnabled = prev;
  // a lâmpada de cada poste; um carro mais perto que o poste, passando na frente dele, tapa o
  // brilho (a lâmpada é desenhada numa camada à parte e a silhueta do carro é apagada dela)
  const tfL = c.getTransform();
  const LW = c.canvas.width, LH = c.canvas.height;
  if (tmpCv.width !== LW || tmpCv.height !== LH) { tmpCv.width = LW; tmpCv.height = LH; }
  const hl = tmpCv.getContext('2d')!;
  // as lâmpadas tapadas por algo vão para o rascunho em lote (retângulos que não se tocam) e voltam
  // para a tela de uma vez: antes era um vaivém de canvas por lâmpada
  const batch: number[][] = [];
  const flushLamps = () => {
    if (!batch.length) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (const [bx0, by0, bx1, by1] of batch) c.drawImage(tmpCv, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
    c.restore();
    batch.length = 0;
  };
  const lampHidden = (st: Street) => {
    const rx = Math.max(4, st.r * 0.26), ry = Math.max(3, st.r * 0.14);
    return lights.some((l) => l.shape && l.y > st.ground && Math.abs(l.x - st.x) < rx + l.w * 0.6 && l.y - l.w * 1.7 < st.head + ry && l.y > st.head - ry)
      || (st.idx >= 0 && occluders.some((o) => o.idx < st.idx && o.x < st.x + rx + 2 && o.x + o.w > st.x - rx - 2 && o.y < st.head + ry + 2 && o.y + o.h > st.head - ry - 2));
  };
  // primeiro as lâmpadas livres (direto na tela), depois as tapadas (no rascunho)
  for (const st of [...streets.filter((q) => !lampHidden(q)), ...streets.filter(lampHidden)]) {
    // a lâmpada: um retângulo aceso nítido (como na arte) e um halo pequeno; poste atrás do topo
    // de uma subida: a luz dele não passa por cima do asfalto que está na frente
    if (st.head > st.clip) continue;
    const rx = Math.max(4, st.r * 0.26), ry = Math.max(3, st.r * 0.14);
    // carros e caminhões mais perto (o baú do caminhão é bem mais alto que um carro) e objetos
    // do cenário mais perto (outdoors, placas, árvores) que passam na frente da lâmpada
    const near = lights.filter((l) => l.shape && l.y > st.ground && Math.abs(l.x - st.x) < rx + l.w * 0.6 && l.y - l.w * 1.7 < st.head + ry && l.y > st.head - ry);
    const occ = st.idx >= 0 ? occluders.filter((o) => o.idx < st.idx && o.x < st.x + rx + 2 && o.x + o.w > st.x - rx - 2 && o.y < st.head + ry + 2 && o.y + o.h > st.head - ry - 2) : [];
    const masked = near.length > 0 || occ.length > 0;
    const dc = masked ? hl : c;
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    if (masked) {
      x0 = Math.max(0, Math.floor(tfL.a * (st.x - rx - 2) + tfL.e)); x1 = Math.min(LW, Math.ceil(tfL.a * (st.x + rx + 2) + tfL.e));
      y0 = Math.max(0, Math.floor(tfL.d * (st.head - ry - 2) + tfL.f)); y1 = Math.min(LH, Math.ceil(tfL.d * (st.head + ry + 2) + tfL.f));
      if (x1 <= x0 || y1 <= y0) continue;
      if (batch.some(([bx0, by0, bx1, by1]) => x0 < bx1 && x1 > bx0 && y0 < by1 && y1 > by0)) flushLamps();
      batch.push([x0, y0, x1, y1]);
      hl.setTransform(1, 0, 0, 1, 0, 0);
      hl.globalCompositeOperation = 'source-over';
      hl.clearRect(x0, y0, x1 - x0, y1 - y0);
      hl.setTransform(tfL);
    }
    dc.save();
    dc.beginPath();
    dc.rect(st.x - st.r, st.head - st.r, st.r * 2, st.clip - (st.head - st.r));
    dc.clip();
    blob(dc, st.x, st.head, rx, ry, '255,190,100', 0.5 * strength);
    blob(dc, st.x, st.head, Math.max(2, st.r * 0.1), Math.max(1.5, st.r * 0.05), '255,230,170', 0.8 * strength);
    const lw = Math.max(2, Math.round(st.r * 0.09)), lh = Math.max(1, Math.round(st.r * 0.03));
    dc.fillStyle = `rgba(255,244,210,${(0.95 * strength).toFixed(3)})`;
    dc.fillRect(Math.round(st.x - lw / 2), Math.round(st.head - lh / 2), lw, lh);
    dc.restore();
    if (masked) {
      hl.globalCompositeOperation = 'destination-out';
      for (const o of occ) {
        hl.save();
        hl.setTransform(1, 0, 0, 1, 0, 0);
        hl.beginPath();
        hl.rect(x0, y0, x1 - x0, y1 - y0); // só no retângulo desta lâmpada (o rascunho leva várias)
        hl.clip();
        hl.setTransform(tfL);
        hl.beginPath();
        hl.rect(vp.x, vp.y - 50, vp.w, Math.max(0, o.clip + 1 - (vp.y - 50)));
        hl.clip();
        hl.drawImage(o.cv, o.x, o.y, o.w, o.h);
        hl.restore();
      }
      for (const l of near) {
        hl.save();
        hl.setTransform(1, 0, 0, 1, 0, 0);
        hl.beginPath();
        hl.rect(x0, y0, x1 - x0, y1 - y0); // só no retângulo desta lâmpada (o rascunho leva várias)
        hl.clip();
        hl.setTransform(tfL);
        hl.beginPath();
        hl.rect(vp.x, vp.y - 50, vp.w, Math.min(vp.h + 100, l.clip + 1 - (vp.y - 50)));
        hl.clip();
        l.shape!(hl);
        hl.restore();
      }
      hl.globalCompositeOperation = 'source-over';
    }
  }
  flushLamps();
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
  if (occDirty) oc.clearRect(0, 0, DW, DH); // limpa a máscara só se o quadro anterior a usou
  occDirty = false;
  let occ = false;
  // objetos do cenário (pedras, árvores, placas, paredões...) também tapam o farol e as lanternas
  // dos carros que estão atrás deles: entram na mesma máscara, do mais perto para o mais longe,
  // antes da luz do primeiro carro que fica atrás de cada um (só os que encostam em alguma luz)
  const box = (l: Light) => { const e = l.w * (l.front ? 2.2 : 1.2) + 10; return [l.x - e, l.y - l.h - e * 0.6, l.x + e, l.y + e * 0.5]; };
  const lbox = lights.map(box);
  const scene = occluders.slice().sort((a, b) => a.idx - b.idx);
  const sceneHit: number[][] = [];
  let oi = 0;
  for (let li = lights.length - 1; li >= 0; li--) {
    const l = lights[li];
    for (; l.idx < Infinity && oi < scene.length && scene[oi].idx < l.idx; oi++) {
      const o = scene[oi];
      let hit = false;
      for (let j = li; j >= 0 && !hit; j--) { const b = lbox[j]; hit = o.x < b[2] && o.x + o.w > b[0] && o.y < b[3] && o.y + o.h > b[1]; }
      if (!hit) continue;
      oc.setTransform(tf);
      oc.save();
      oc.beginPath();
      oc.rect(vp.x, vp.y - 50, vp.w, Math.max(0, Math.min(vp.h + 100, o.clip + 1 - (vp.y - 50))));
      oc.clip();
      oc.drawImage(o.cv, o.x, o.y, o.w, o.h);
      oc.restore();
      sceneHit.push([o.x, o.y, o.x + o.w, o.y + o.h]);
      occ = true;
      occDirty = true;
    }
    const L = l.x - l.w / 2, T = l.y - l.h;
    // lâmpadas atrás de uma crista não aparecem (o carro está escondido pelo morro)
    const pts = l.dots.map(([u, f]) => [L + u * l.w, T + f * l.h]).filter(([, py]) => py <= l.clip + 1);
    if (pts.length) {
      // área da luz em pixels do canvas (o brilho e o clarão não passam de ~2 larguras do carro)
      const ext = l.w * (l.front ? 2.2 : 1.2) + 10;
      const x0 = Math.max(0, Math.floor(tf.a * (l.x - ext) + tf.e)), x1 = Math.min(DW, Math.ceil(tf.a * (l.x + ext) + tf.e));
      const y0 = Math.max(0, Math.floor(tf.d * (T - ext * 0.6) + tf.f)), y1 = Math.min(DH, Math.ceil(tf.d * (l.y + ext * 0.5) + tf.f));
      // só passa pela camada recortada se algum carro mais perto encosta nesta luz
      const lb = lbox[li];
      const masked = occ && (lights.slice(li + 1).some((n) => n.shape && Math.abs(n.x - l.x) < ext + n.w / 2) || sceneHit.some((o) => o[0] < lb[2] && o[2] > lb[0] && o[1] < lb[3] && o[3] > lb[1]));
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
            // de longe o halo encolhe junto com o carro (não cobre a pista e os morros em volta)
            blob(dc, px, py, Math.max(l.w * 0.55 * k, Math.min(5, l.w * 0.7)), Math.max(l.w * 0.4 * k, Math.min(3.5, l.w * 0.45)), '255,244,200', 0.75 * strength);
            blob(dc, px, py, Math.max(l.w * 0.16, 1.6), Math.max(l.w * 0.13, 1.3), '255,255,245', 1 * strength);
            // raios curtos (estrela) dos faróis vistos de frente
            dc.fillStyle = `rgba(255,250,225,${(0.5 * strength).toFixed(3)})`;
            dc.fillRect(px - l.w * 0.5 * k, py - 0.5, l.w * k, 1);
            dc.fillRect(px - 0.5, py - l.w * 0.18 * k, 1, l.w * 0.36 * k);
          }
          // clarão no asfalto entre o carro e o jogador
          // (longo: o farol de quem vem ilumina a pista bem à frente dele)
          blob(dc, l.x, l.y + l.w * 0.2, l.w * 1.6 * k, l.w * 0.6, '255,240,190', 0.38 * strength);
        } else {
          // lanternas: brilho vermelho em cada lâmpada; no freio fica bem mais forte, com halo
          // grande e o reflexo vermelho no asfalto atrás do carro
          // de longe a lâmpada continua um ponto vermelho bem visível (tamanho mínimo e mais forte),
          // como lanterna acesa na estrada escura
          const far = Math.max(0, Math.min(1, (24 - l.w) / 18)); // 1 = bem longe
          const m = (v: number, min: number) => Math.max(v, Math.min(min * far, l.w * 0.35 + 1));
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
      occDirty = true;
    }
  }
  occluders.length = 0;
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

// giroflex da polícia: vermelho e azul se alternando (o mesmo ritmo das lâmpadas da viatura)
export const sirenPhase = () => Math.floor(performance.now() / 120) % 2 === 0;
// no retrovisor: o brilho de cada cor em cima do teto da viatura (com tamanho mínimo, de longe é
// um pisca vermelho/azul)
export function sirenGlow(c: CanvasRenderingContext2D, x: number, y: number, bw: number, near: number, strength: number, minTop = -Infinity) {
  if (strength <= 0.02) return;
  const on = sirenPhase();
  const r = Math.max(2.5, bw * 0.55), ry = Math.max(1.6, bw * 0.32), top = Math.max(minTop, y - Math.max(2, bw * 0.75));
  c.save();
  c.globalCompositeOperation = 'lighter';
  blob(c, x - bw * 0.18, top, r, ry, '70,110,255', (on ? 0.95 : 0.25) * (0.5 + 0.5 * near) * strength);
  blob(c, x + bw * 0.18, top, r, ry, '255,40,40', (on ? 0.25 : 0.95) * (0.5 + 0.5 * near) * strength);
  c.restore();
}
// o espelho todo e a cabine tingidos pela luz que vem de trás, trocando de cor
export function sirenWash(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, near: number, strength: number, k = 1) {
  if (near <= 0.01 || strength <= 0.02) return;
  const on = sirenPhase();
  const a = near * strength;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const side = (x0: number, x1: number, rgb: string, k: number) => {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(${rgb},${(k * a).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0), h);
  };
  side(x, x + w * 0.65, on ? '60,100,255' : '255,40,40', 0.32 * k);
  side(x + w, x + w * 0.35, on ? '255,40,40' : '60,100,255', 0.12 * k);
  c.restore();
}
