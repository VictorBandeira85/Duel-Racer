// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean; clip: number; shape?: (g: CanvasRenderingContext2D, game?: boolean) => void; plate?: number[] }
const lights: Light[] = [];
let collecting = false;

// postes de luz acesos (render3d registra cada um visível: lâmpada na tela, tamanho, trecho da
// pista onde está e posição lateral em meias larguras da pista a partir do centro)
interface Street { x: number; head: number; r: number; d: number; u: number; clip: number; ground: number }
const streets: Street[] = [];
export function pushStreetLight(x: number, head: number, r: number, d: number, u: number, ground = Infinity) {
  if (collecting && r > 2) streets.push({ x, head, r: Math.min(r, 110), d, u, clip: clipY, ground });
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
export function pushCarLights(x: number, y: number, w: number, look: CarLook, spots: { h: number; dots: number[][] }, shape?: (g: CanvasRenderingContext2D, game?: boolean) => void) {
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
let occDirty = true;
let warmCv: HTMLCanvasElement | null = null;
const REACH = 64; // alcance do farol, em segmentos (~90 m de chão iluminado)
// a escuridão e as luzes são polígonos de brilho chapado (degraus da pixel art) desenhados direto,
// sem reprocessar os pixels a cada quadro
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
  // só o chão à frente: o que aparece pelas janelas laterais, abaixo da linha do painel, fica ao
  // lado do carro, fora do facho
  g.save();
  g.beginPath();
  g.rect(0, 0, w, seen + 6);
  g.clip();
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
    const fk = fd(road[k].d);
    const step = fk < 0.4 && k + 3 < road.length && road[k + 3].d - road[k].d <= 6 ? 3 : fk < 0.75 && k + 2 < road.length && road[k + 2].d - road[k].d <= 4 ? 2 : 1;
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

// farol de quem vai à frente (na mesma mão): a mancha de luz no asfalto adiante dele
// (quadrilátero em coordenadas de tela: perto esquerda/direita, longe direita/esquerda)
// end: índice do último segmento da pista que o facho alcança (objetos até ali tapam a luz)
interface Beam { p: number[]; clip: number; end: number }
const carBeams: Beam[] = [];
export function pushCarBeam(p: number[], clip: number, end = Infinity) {
  if (collecting) carBeams.push({ p, clip, end });
}
// objetos do cenário (árvores, viadutos, placas, prédios...) com o índice do segmento: tapam o
// facho dos carros de trás deles
interface Occ { cv: CanvasImageSource; x: number; y: number; w: number; h: number; idx: number; clip: number }
const occluders: Occ[] = [];
export function pushOccluder(o: Occ) {
  if (collecting) occluders.push(o);
}
function drawCarBeams(g: CanvasRenderingContext2D, ox: number, oy: number, a: number, list: Beam[] = carBeams) {
  const SPILL = `rgba(0,0,0,${a})`;
  for (const b of list) {
    const [x0, y0, x1, , x2, y2, x3] = b.p;
    const grad = g.createLinearGradient(0, y0 - oy, 0, y2 - oy);
    grad.addColorStop(0, `rgba(0,0,0,${a})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${(a * 0.75).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.beginPath();
    g.rect(0, 0, g.canvas.width, b.clip - oy);
    g.clip();
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0 - ox, y0 - oy);
    g.lineTo(x1 - ox, y0 - oy);
    g.lineTo(x2 - ox, y2 - oy);
    g.lineTo(x3 - ox, y2 - oy);
    g.closePath();
    g.fill();
    // clarão no asfalto logo à frente do para-choque
    const mx = (x0 + x1) / 2 - ox, hw = (x1 - x0) * 0.85, my = y0 - oy - Math.max(2, (y0 - y2) * 0.3);
    const rg = g.createRadialGradient(mx, my, 0, mx, my, hw);
    rg.addColorStop(0, SPILL);
    rg.addColorStop(1, SPILL.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = rg;
    g.save();
    g.translate(mx, my);
    g.scale(1, 0.35);
    g.translate(-mx, -my);
    g.fillRect(mx - hw, my - hw, hw * 2, hw * 2);
    g.restore();
    g.restore();
  }
}
function drawCarBeamsWarm(g: CanvasRenderingContext2D, ox: number, oy: number, a: number, list: Beam[] = carBeams) {
  const SPILL = `rgba(255,226,160,${(a * 1.2).toFixed(3)})`;
  for (const b of list) {
    const [x0, y0, x1, , x2, y2, x3] = b.p;
    const grad = g.createLinearGradient(0, y0 - oy, 0, y2 - oy);
    grad.addColorStop(0, `rgba(255,226,160,${Math.min(1, a).toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(255,226,160,${Math.min(1, a * 0.75).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,226,160,0)');
    g.save();
    g.beginPath();
    g.rect(0, 0, g.canvas.width, b.clip - oy);
    g.clip();
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0 - ox, y0 - oy);
    g.lineTo(x1 - ox, y0 - oy);
    g.lineTo(x2 - ox, y2 - oy);
    g.lineTo(x3 - ox, y2 - oy);
    g.closePath();
    g.fill();
    // clarão no asfalto logo à frente do para-choque
    const mx = (x0 + x1) / 2 - ox, hw = (x1 - x0) * 0.85, my = y0 - oy - Math.max(2, (y0 - y2) * 0.3);
    const rg = g.createRadialGradient(mx, my, 0, mx, my, hw);
    rg.addColorStop(0, SPILL);
    rg.addColorStop(1, SPILL.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = rg;
    g.save();
    g.translate(mx, my);
    g.scale(1, 0.35);
    g.translate(-mx, -my);
    g.fillRect(mx - hw, my - hw, hw * 2, hw * 2);
    g.restore();
    g.restore();
  }
}
// camada de luz secundária: desenha (draw) e apaga as silhuetas de todos os carros registrados
const secCv = document.createElement('canvas');
const carCv = document.createElement('canvas');
// quanto cada carro está iluminado (0..1): nosso farol pela distância e posição na tela, mais a
// luz de um poste perto do trecho dele
function carLighting(rd: RoadPt[], cx: number, seen: number, top: number, ox: number) {
  const d0 = Math.max(0, (rd.find((p) => p.y < seen - 1)?.d ?? 0) - 6);
  return (l: Light) => {
    const y = l.y - top;
    let best: RoadPt | null = null;
    for (const p of rd) if (!best || Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
    if (!best) return 0;
    const f = 1 - (best.d - d0) / REACH;
    const half = best.w * (1.75 - 1.1 * Math.max(0, f));
    let lit = 0;
    if (f > 0 && Math.abs(l.x - ox - cx) < half + l.w / 2) lit = 0.9 * Math.min(1, 1.2 * f ** 0.85);
    for (const st of streets) {
      const dd = Math.abs(best.d - st.d);
      if (dd <= POOL) lit += 0.7 * (dd <= 1 ? 1 : dd <= 2 ? 0.8 : dd <= 3.5 ? 0.55 : dd <= 5 ? 0.32 : 0.15);
    }
    return Math.min(1, lit);
  };
}
// apaga a silhueta de cada carro da camada e pinta de novo com uma cor por inteiro (fill)
function shadeCars(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, fill: (l: Light) => string, erase: boolean) {
  if (carCv.width !== W || carCv.height !== H) {
    carCv.width = W;
    carCv.height = H;
  }
  const t = carCv.getContext('2d')!;
  // do mais longe (mais alto na tela) para o mais perto: o da frente cobre o de trás
  for (const l of lights.filter((n) => n.shape).sort((a, b) => a.y - b.y)) {
    if (!l.shape) continue;
    const x0 = Math.max(0, Math.floor(l.x - l.w * 0.75 - ox)), x1 = Math.min(W, Math.ceil(l.x + l.w * 0.75 - ox));
    const y0 = Math.max(0, Math.floor(l.y - l.w * 1.2 - oy)), y1 = Math.min(H, Math.ceil(l.y + l.w * 0.2 + 2 - oy), Math.ceil(Math.max(l.clip + 1, l.clip >= l.y - 1 ? l.y + l.w * 0.2 + 2 : 0) - oy));
    if (x1 <= x0 || y1 <= y0) continue;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = 'source-over';
    t.clearRect(x0, y0, x1 - x0, y1 - y0);
    t.save();
    t.beginPath();
    t.rect(x0, y0, x1 - x0, y1 - y0);
    t.clip();
    t.translate(-ox, -oy);
    l.shape(t, true);
    t.restore();
    if (erase) {
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(carCv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = fill(l);
    t.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(carCv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }
  g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
}
const beamCv = document.createElement('canvas');
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
  // cada facho num rascunho à parte: os objetos do cenário que ficam na frente dele (árvores,
  // viadutos, placas) apagam a luz onde a tapam
  if (beam && carBeams.length) {
    if (beamCv.width !== W || beamCv.height !== H) {
      beamCv.width = W;
      beamCv.height = H;
    }
    const t = beamCv.getContext('2d')!;
    for (const b of carBeams) {
      const xs = [b.p[0], b.p[2], b.p[4], b.p[6]], ys = [b.p[1], b.p[3], b.p[5], b.p[7]];
      const hw = Math.abs(b.p[2] - b.p[0]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs) - hw - ox)), x1 = Math.min(W, Math.ceil(Math.max(...xs) + hw - ox));
      const y0 = Math.max(0, Math.floor(Math.min(...ys) - hw - oy)), y1 = Math.min(H, Math.ceil(Math.max(...ys) + hw - oy));
      if (x1 <= x0 || y1 <= y0) continue;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = 'source-over';
      t.clearRect(x0, y0, x1 - x0, y1 - y0);
      beam(t, b);
      t.globalCompositeOperation = 'destination-out';
      for (const o of occluders) {
        if (o.idx > b.end) continue;
        if (o.x - ox > x1 || o.x + o.w - ox < x0 || o.y - oy > y1 || o.y + o.h - oy < y0) continue;
        t.save();
        t.beginPath();
        t.rect(x0, y0, x1 - x0, Math.min(y1, o.clip - oy + 1) - y0);
        t.clip();
        t.drawImage(o.cv, o.x - ox, o.y - oy, o.w, o.h);
        t.restore();
      }
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
export interface Pass { x: number; dz: number } // quem vem atrás com farol aceso (dz > 0 atrás)

// fim da pista: escuridão, luzes dos carros somadas e a claridade de quem emparelha
// lua (ou outra luz do céu) que não deve ser apagada pela escuridão da noite
let sky: { x: number; y: number; r: number; floor: number } | null = null;
// floor: linha da tela abaixo da qual o furo de luz não passa (os morros e o chão ficam escuros)
export function setSkyLight(x: number, y: number, r: number, floor = Infinity) {
  sky = { x, y, r, floor };
}
export function finishNight(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number; horizon: number; dash?: number }, strength: number, passers: Pass[], segLen: number, road: RoadPt[] = []) {
  collecting = false;
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
  const rd = road.map((p) => ({ d: p.d, x: p.x - vp.x, y: p.y - top, w: p.w }));
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
  beamShape(g, W, cx, seen - top, ground, 0.9);
  reflectors(g, vp.x, top, 'rgba(0,0,0,', 1);
  // postes acesos e faróis de quem vai à frente: luz só no chão, numa camada à parte da qual as
  // silhuetas dos carros são apagadas (a mancha de luz não passa por cima de nenhum carro)
  const sec = secondary(W, H, vp.x, top, (s) => {
    for (const st of streets) streetPool(s, rd, st, 'rgba(0,0,0,', 0.7);
  }, (t, b) => drawCarBeams(t, vp.x, top, 0.85, [b])); // farol de quem vai à frente (15% mais fraco)
  if (sec) g.drawImage(sec, 0, 0);
  // cada carro com uma luz só no corpo inteiro (o facho ou a luz do poste não cortam a
  // carroceria ao meio): conforme a distância no nosso farol e a proximidade de um poste
  const litOf = carLighting(rd, cx, seen - top, top, vp.x);
  shadeCars(g, W, H, vp.x, top, (l) => `rgba(0,0,10,${(0.8 * strength * (1 - 0.68 * litOf(l))).toFixed(3)})`, true);
  if (sky) {
    const sx = sky.x - vp.x, sy = sky.y - top;
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sky.r);
    sg.addColorStop(0, 'rgba(0,0,0,1)');
    sg.addColorStop(0.4, 'rgba(0,0,0,0.8)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg;
    g.fillRect(sx - sky.r, sy - sky.r, sky.r * 2, Math.min(sky.r * 2, sky.floor - top - (sy - sky.r)));
    sky = null;
  }
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
  const secW = secondary(W, H, vp.x, top, (s) => {
    for (const st of streets) streetPool(s, rd, st, 'rgba(255,190,90,', 0.2 * strength);
  }, (t, b) => drawCarBeamsWarm(t, vp.x, top, 0.935 * strength, [b]));
  occluders.length = 0;
  if (secW) wg.drawImage(secW, 0, 0);
  shadeCars(wg, W, H, vp.x, top, (l) => `rgba(255,226,160,${(0.1 * litOf(l)).toFixed(3)})`, false);
  carBeams.length = 0;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = Math.min(1, strength); // no lusco-fusco a luz do farol ainda quase não aparece
  c.drawImage(warmCv, vp.x, top);
  c.globalAlpha = 1;
  c.imageSmoothingEnabled = prev;
  // a lâmpada de cada poste; um carro mais perto que o poste, passando na frente dele, tapa o
  // brilho (a lâmpada é desenhada numa camada à parte e a silhueta do carro é apagada dela)
  const tfL = c.getTransform();
  const LW = c.canvas.width, LH = c.canvas.height;
  if (tmpCv.width !== LW || tmpCv.height !== LH) { tmpCv.width = LW; tmpCv.height = LH; }
  const hl = tmpCv.getContext('2d')!;
  for (const st of streets) {
    // a lâmpada: um retângulo aceso nítido (como na arte) e um halo pequeno; poste atrás do topo
    // de uma subida: a luz dele não passa por cima do asfalto que está na frente
    if (st.head > st.clip) continue;
    const rx = Math.max(4, st.r * 0.26), ry = Math.max(3, st.r * 0.14);
    const near = lights.filter((l) => l.shape && l.y > st.ground && Math.abs(l.x - st.x) < rx + l.w * 0.6 && l.y - l.w * 0.9 < st.head + ry && l.y > st.head - ry);
    const dc = near.length ? hl : c;
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    if (near.length) {
      x0 = Math.max(0, Math.floor(tfL.a * (st.x - rx - 2) + tfL.e)); x1 = Math.min(LW, Math.ceil(tfL.a * (st.x + rx + 2) + tfL.e));
      y0 = Math.max(0, Math.floor(tfL.d * (st.head - ry - 2) + tfL.f)); y1 = Math.min(LH, Math.ceil(tfL.d * (st.head + ry + 2) + tfL.f));
      if (x1 <= x0 || y1 <= y0) continue;
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
    if (near.length) {
      hl.globalCompositeOperation = 'destination-out';
      for (const l of near) {
        hl.save();
        hl.setTransform(tfL);
        hl.beginPath();
        hl.rect(vp.x, vp.y - 50, vp.w, Math.min(vp.h + 100, l.clip + 1 - (vp.y - 50)));
        hl.clip();
        l.shape!(hl);
        hl.restore();
      }
      hl.globalCompositeOperation = 'source-over';
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(tmpCv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      c.restore();
    }
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
  if (occDirty) oc.clearRect(0, 0, DW, DH); // limpa a máscara só se o quadro anterior a usou
  occDirty = false;
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
          // (longo: o farol de quem vem ilumina a pista bem à frente dele)
          blob(dc, l.x, l.y + l.w * 0.2, l.w * 1.6 * k, l.w * 0.6, '255,240,190', 0.38 * strength);
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
      occDirty = true;
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
