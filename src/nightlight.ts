// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';
import { lowFx } from './perf';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean; clip: number; idx: number; shape?: (g: CanvasRenderingContext2D, game?: boolean) => void; plate?: number[] }
const lights: Light[] = [];
let collecting = false;

// postes de luz acesos (render3d registra cada um visível: lâmpada na tela, tamanho, trecho da
// pista onde está e posição lateral em meias larguras da pista a partir do centro)
// idx: segmento do poste no laço do desenho (objetos de segmentos mais perto tapam a luz dele)
// k: entra aos poucos com a distância (o poste aparece lá longe sem a luz acender de uma vez)
interface Street { x: number; head: number; r: number; d: number; u: number; clip: number; ground: number; idx: number; k: number }
const streets: Street[] = [];
export function pushStreetLight(x: number, head: number, r: number, d: number, u: number, ground = Infinity, idx = -1) {
  const k = Math.max(0, Math.min(1, (165 - d) / 45));
  if (collecting && r > 2 && k > 0) streets.push({ x, head, r: Math.min(r, 110), d, u, clip: clipY, ground, idx, k });
}
// holofote do helicóptero da polícia (heli.ts): mancha oval de luz branca no chão, no trecho d
// (segmentos, contínuo) e na posição lateral u (meias larguras da pista), com rd segmentos de meio
// comprimento e ru meias larguras de meia largura; entra na mesma camada das luzes dos postes
interface Spot { d: number; u: number; rd: number; ru: number; k: number }
const spots: Spot[] = [];
export function pushSpotPool(d: number, u: number, rd: number, ru: number, k = 1) {
  if (collecting && k > 0.01) spots.push({ d, u, rd, ru, k });
}
function spotPool(g: CanvasRenderingContext2D, road: RoadPt[], sp: Spot, a0: number) {
  // três degraus (borda, meio e miolo), como as faixas dos postes: sem degradê
  for (const [m, a] of [[1, 0.45], [0.72, 0.75], [0.42, 1]]) {
    g.fillStyle = `rgba(225,235,255,${(a0 * a * sp.k).toFixed(3)})`;
    for (let k = 0; k + 1 < road.length; k++) {
      const p = road[k], q = road[k + 1];
      if (q.d - p.d > 2) continue;
      const ep = 1 - ((p.d - sp.d) / (sp.rd * m)) ** 2, eq = 1 - ((q.d - sp.d) / (sp.rd * m)) ** 2;
      if (ep <= 0 && eq <= 0) continue;
      const hp = sp.ru * m * Math.sqrt(Math.max(0, ep)), hq = sp.ru * m * Math.sqrt(Math.max(0, eq));
      g.beginPath();
      g.moveTo(p.x + p.w * (sp.u - hp), p.y + 0.5);
      g.lineTo(p.x + p.w * (sp.u + hp), p.y + 0.5);
      g.lineTo(q.x + q.w * (sp.u + hq), q.y - 0.5);
      g.lineTo(q.x + q.w * (sp.u - hq), q.y - 0.5);
      g.closePath();
      g.fill();
    }
  }
}
// linha da tela abaixo da qual o trecho sendo desenhado fica escondido (crista de morro à frente)
// e o índice desse trecho na pista (os objetos do cenário de trechos mais perto tapam as luzes dele)
let clipY = Infinity, clipIdx = Infinity;
export function setLightClip(y: number, idx = Infinity) {
  clipY = y;
  clipIdx = idx;
}
// fachadas iluminadas (posto de gasolina e a placa dele): retângulo do sprite na tela
interface Facade { kind: 'station' | 'gasSign'; x: number; y: number; w: number; h: number; clip: number; idx: number }
const fronts: Facade[] = [];
export function pushFacade(kind: Facade['kind'], x: number, y: number, w: number, h: number) {
  if (collecting && w > 1) fronts.push({ kind, x, y, w, h, clip: clipY, idx: clipIdx });
}
// o posto aceso de noite: cobertura branca brilhando, faixa vermelha, a loja iluminada, a luz que
// desce da cobertura para as bombas e um halo que se vê de longe na estrada escura
function facadeLight(c: CanvasRenderingContext2D, f: Facade, strength: number) {
  const { x, y, w, h } = f;
  {
    if (f.kind === 'station') {
      // geometria do posto desenhado pelo Victor (src/assets/scenery/station*.png): cobertura com o
      // letreiro em toda a largura no alto, três luminárias embaixo dela, loja no meio
      const L = x - w * 0.47, cw = w * 0.94;
      blob(c, x, y - h * 0.7, Math.max(w * 0.9, 8), Math.max(h * 0.4, 4), '255,250,230', 0.22 * strength);
      // letreiro aceso (só clareia: as letras e faixas da arte continuam)
      c.fillStyle = `rgba(255,240,230,${(0.28 * strength).toFixed(3)})`;
      c.fillRect(L, y - h * 0.86, cw, h * 0.2);
      // luz descendo da cobertura até o chão das bombas
      c.fillStyle = `rgba(255,250,225,${(0.16 * strength).toFixed(3)})`;
      c.beginPath();
      c.moveTo(L + cw * 0.08, y - h * 0.6);
      c.lineTo(L + cw * 0.92, y - h * 0.6);
      c.lineTo(L + cw * 1.04, y);
      c.lineTo(L - cw * 0.04, y);
      c.closePath();
      c.fill();
      c.fillStyle = `rgba(255,250,225,${(0.28 * strength).toFixed(3)})`;
      c.fillRect(L - cw * 0.06, y - h * 0.05, cw * 1.12, h * 0.06);
      // vitrine e porta da loja
      c.fillStyle = `rgba(255,225,150,${(0.4 * strength).toFixed(3)})`;
      c.fillRect(x - w * 0.18, y - h * 0.5, w * 0.36, h * 0.3);
    } else {
      blob(c, x, y - h * 0.78, Math.max(w * 0.9, 6), Math.max(h * 0.35, 4), '140,170,255', 0.28 * strength);
      // a placa iluminada por dentro: o painel clareia, mantendo o desenho (letras e faixas)
      c.fillStyle = `rgba(90,120,220,${(0.3 * strength).toFixed(3)})`;
      c.fillRect(x - w / 2, y - h, w, h * 0.45);
      c.fillStyle = `rgba(255,255,240,${(0.3 * strength).toFixed(3)})`;
      c.fillRect(x - w / 2 + w * 0.04, y - h * 0.68, w * 0.92, h * 0.1);
    }
  }
}
// placas e outdoors que o farol alcança: brilham mais conforme o carro se aproxima
interface Reflector { kind: string; x: number; y: number; w: number; h: number; dist: number; clip: number }
const refl: Reflector[] = [];
export function pushReflector(kind: string, x: number, y: number, w: number, h: number, dist: number) {
  if (!collecting || w <= 1.5 || dist >= 120) return;
  const r = { kind, x, y, w, h, dist, clip: clipY };
  refl.push(r);
  // a placa é o último objeto registrado (render3d chama pushOccluder logo antes): o brilho dela é
  // desenhado junto com a silhueta, e tudo o que está mais perto (carros, objetos) passa por cima
  const o = occluders[occluders.length - 1];
  if (o) o.refl = r;
}
// o farol ilumina a face da placa (as cores verdadeiras aparecem, mais fortes conforme o carro chega
// perto): pinta a face em g com a opacidade a*k; (ox, oy) desloca para a camada
function reflectorFace(g: CanvasRenderingContext2D, r: Reflector, ox: number, oy: number, mul: number) {
  const k = Math.min(1, (1 - r.dist / 120) * 1.5) ** 1.3; // começa a refletir de longe; perto: mais claro
  if (k <= 0.02) return;
  const x = r.x - ox, y = r.y - oy, { w, h } = r;
  g.save();
  g.beginPath();
  g.rect(x - w, y - h * 1.2, w * 2, Math.min(h * 1.2, r.clip - oy + 1 - (y - h * 1.2)));
  g.clip();
  // placas refletivas acendem mais que o papel dos outdoors
  const a = (r.kind === 'billboard' ? 0.75 : 0.95) * k * mul;
  g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
  // proporções das artes da beira da estrada (tools/ref/road_objects.py)
  if (r.kind === 'billboard') g.fillRect(x - w / 2, y - h * 0.88, w, h * 0.5);
  else if (r.kind === 'gasSign') g.fillRect(x - w / 2, y - h, w, h * 0.45);
  else if (r.kind === 'gasKm') g.fillRect(x - w / 2, y - h, w, h * 0.71);
  else if (r.kind === 'blitz' || r.kind === 'obras' || r.kind === 'desvio') g.fillRect(x - w / 2, y - h, w, h * 0.6); // placas da blitz e da obra (src/blitz.ts)
  else if (r.kind.startsWith('warn') || r.kind.startsWith('sharp')) {
    const cy = y - h * 0.75, rr = w * 0.5;
    g.beginPath();
    g.moveTo(x, cy - rr);
    g.lineTo(x + rr, cy);
    g.lineTo(x, cy + rr);
    g.lineTo(x - rr, cy);
    g.closePath();
    g.fill();
  } else if (r.kind === 'stop') g.fillRect(x - w / 2, y - h, w, h * 0.45);
  else g.fillRect(x - w / 2, y - h, w, h * 0.63);
  g.restore();
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
  shadeOcc = [];
  streets.length = 0;
  spots.length = 0;
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
let warmCv: HTMLCanvasElement | null = null;
const moonCv = document.createElement('canvas');
const REACH = 64; // alcance do farol, em segmentos (~90 m de chão iluminado)
// para onde o facho aponta: posição do carro na pista (meias larguras, do centro) e o volante
// (suavizado: no teclado ele vai de 0 a 1 de uma vez e o facho pularia)
let aimSteer = 0;
// bordas do facho (em meias larguras da pista) a uma fração t do alcance (0 junto ao carro, 1 no
// fim): nasce na frente do carro e abre com a distância até pegar a pista toda.
// l / r: até onde o facho vai para a esquerda e para a direita do eixo do carro. Os dois lados abrem
// igual (pedido do Victor: luz uniforme dos dois lados): já junto do carro pega a nossa faixa inteira,
// as linhas e o acostamento/faixa ao lado; o chão visto pela janela do motorista fica fora pelo
// recorte em trapézio abaixo do painel
function beamAt(t: number) {
  return { l: 1.0 + 1.25 * t, r: 1.0 + 1.25 * t };
}
// O facho é um cone preso ao carro: sai RETO na direção em que o carro aponta (o meio da tela, em
// todas as distâncias), sem dobrar com a pista. Numa curva a pista sai de dentro do cone e a luz
// cai no que estiver à frente em linha reta (acostamento, grama, objetos de fora da curva).
// beamCx: coluna da tela (na camada) para onde o carro aponta
let beamCx = 0;
// perto do carro a luz ainda está baixa e fraca (zona logo à frente do capô) e sobe em degraus até
// a força cheia a uns 9 segmentos
const nearK = (z: number) => (z <= 2.5 ? 0.42 : z >= 9 ? 1 : 0.42 + 0.58 * ((z - 2.5) / 6.5));
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
// (contínuo: a distância do chão exatamente na linha do painel, interpolada entre os dois trechos
// vizinhos; antes era a do primeiro trecho acima dela, que saltava um trecho a cada trecho
// percorrido e fazia o facho inteiro "pular" de quadro em quadro)
const zOf = (p: RoadPt) => p.z ?? p.d;
// ponto da pista entre a e b à distância z (na projeção, linha, centro e largura andam com 1/z)
function lerpPt(a: RoadPt, b: RoadPt, z: number): RoadPt {
  const za = zOf(a), zb = zOf(b);
  const u = za > 0.05 && zb > 0.05 && Math.abs(1 / zb - 1 / za) > 1e-9 ? (1 / z - 1 / za) / (1 / zb - 1 / za) : (z - za) / (zb - za || 1);
  const m = (x: number, y: number) => x + (y - x) * u;
  return { d: m(a.d, b.d), x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), z, h: a.h === undefined || b.h === undefined ? undefined : a.h + (b.h - a.h) * (z - za) / (zb - za || 1) };
}
// distância do chão que aparece na linha y da tela (entre os trechos vizinhos, ou prolongando os
// dois primeiros quando a linha fica abaixo do trecho mais perto)
function zAtY(road: RoadPt[], y: number) {
  if (road.length < 2) return road.length ? zOf(road[0]) : 0;
  let k = 0;
  while (k + 2 < road.length && road[k + 1].y >= y) k++;
  const a = road[k], b = road[k + 1], za = zOf(a), zb = zOf(b);
  if (za <= 0.05 || zb <= 0.05 || a.y === b.y) return a.y >= y ? zb : za;
  const iz = 1 / za + ((y - a.y) / (b.y - a.y)) * (1 / zb - 1 / za);
  return iz > 1e-6 ? 1 / iz : zb;
}
function beamZ0(road: RoadPt[], seen: number) {
  return Math.max(0, zAtY(road, seen - 1) - 6);
}
// borda lateral macia: faixas encaixadas, cada uma um pouco mais estreita e mais clara (degraus
// finos de pixel art, de 2 px ou mais na resolução do jogo), até o miolo; T: brilho de cada uma
// em relação ao miolo
const SOFT_T = [0.35, 0.62, 0.84, 1];
const LEVELS = 20; // degraus de brilho ao longo do facho (5% cada; trechos vizinhos no mesmo degrau viram um polígono só)
// O facho é desenhado numa máscara (alpha = luz) guardada entre os quadros: ele é preso ao carro, e
// numa pista plana a forma dele na tela não muda (nem numa curva: o cone é reto); só é refeito quando
// o chão à frente muda de forma (subida, descida, crista, inclinação do carro) ou a tela muda.
const beamMask = document.createElement('canvas');
let beamKey = '', beamBuilds = 0;
let beamBox = [0, 0, 0, 0]; // retângulo da máscara onde há luz
function beamShape(g: CanvasRenderingContext2D, w: number, cx: number, seen: number, road: RoadPt[], scale: number) {
  if (!road.length) return;
  const H0 = g.canvas.height;
  const z0 = beamZ0(road, seen);
  // chave: o chão em distâncias fixas a partir do carro (linha, largura e o quanto o cone pega)
  const ptAt = (z: number) => {
    let k = 0;
    while (k + 2 < road.length && zOf(road[k + 1]) < z) k++;
    return road.length > 1 ? lerpPt(road[k], road[k + 1], z) : road[0];
  };
  const zEnd = zOf(road[road.length - 1]);
  // (meio pixel de folga: o carro balançando não refaz a máscara a cada quadro)
  let key = `${w}x${H0}|${seen}|${cx}|${beamPitch.toFixed(2)}|${Math.round(Math.min(zEnd, z0 + REACH))}`;
  for (let i = 0; i <= 12; i++) {
    const z = z0 - 4 + ((REACH + 4) * i) / 12;
    if (z > zEnd) break;
    const q = ptAt(z);
    key += `|${Math.round(q.y * 2)},${Math.round(q.w * 2)},${coneAt(q).toFixed(1)}`;
  }
  if (key !== beamKey || beamMask.width !== w || beamMask.height !== H0) {
    beamKey = key;
    beamBuilds++;
    drawBeamMask(w, H0, cx, seen, road, z0);
  }
  // (só o retângulo onde há luz)
  const [bx0, by0, bx1, by1] = beamBox;
  if (bx1 <= bx0 || by1 <= by0) return;
  g.globalAlpha = scale;
  g.drawImage(beamMask, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
  g.globalAlpha = 1;
}
function drawBeamMask(w: number, H0: number, cx: number, seen: number, road: RoadPt[], z0: number) {
  if (beamMask.width !== w || beamMask.height !== H0) { beamMask.width = w; beamMask.height = H0; }
  const g = beamMask.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, w, H0);
  g.save();
  // só o chão à frente: o que aparece pelas janelas laterais, abaixo da linha do painel, fica ao
  // lado do carro, fora do facho
  // (abaixo da linha do painel a luz continua num trapézio que estreita para baixo: o asfalto que
  // aparece entre a linha do painel e o capô, logo à frente do carro, não fica num vão escuro, e o
  // facho largo não acaba num corte reto de nenhum lado)
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, seen + 6);
  g.lineTo(w * 0.84, Math.max(seen + 6, H0));
  g.lineTo(w * 0.16, Math.max(seen + 6, H0)); // simétrico: o facho é igual dos dois lados (sem corte reto à esquerda)
  g.lineTo(0, seen + 6);
  g.closePath();
  g.clip();
  const tOf = (p: RoadPt) => Math.max(0, (zOf(p) - z0) / REACH);
  // brilho (em degraus de 0 a LEVELS) num ponto do chão: cai aos poucos para longe até sumir no fim
  // do alcance (sem corte reto), e é mais fraco logo à frente do capô
  const F = (p: RoadPt) => beamFall(tOf(p)) * coneAt(p) * nearK(zOf(p)) * LEVELS;
  // pontos do caminho (de perto para longe). O primeiro fica preso ao pé da camada (e não no trecho
  // mais perto, que muda a cada trecho percorrido; abaixo dele o chão é prolongado pelos dois
  // primeiros trechos)
  const pts: RoadPt[] = [];
  let k0 = 0;
  if (road.length > 1) {
    while (k0 + 1 < road.length && road[k0 + 1].y > H0) k0++;
    const z = zAtY(road, H0);
    if (k0 + 1 < road.length && z > 0.05 && z < zOf(road[k0 + 1])) {
      pts.push(lerpPt(road[k0], road[k0 + 1], z));
      k0++;
    }
  }
  for (let k = k0; k < road.length; k++) {
    pts.push(road[k]);
    if (tOf(road[k]) >= 1) break;
  }
  // os degraus de brilho mudam em distâncias fixas a partir do carro (onde o brilho cruza meio
  // degrau), não nos trechos da pista: os trechos andam com o carro e os degraus pulavam junto
  const nodes: RoadPt[] = [pts[0]];
  const fv: number[] = [F(pts[0])];
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1], Fa = fv[fv.length - 1], Fb = F(b);
    const lo = Math.min(Fa, Fb), hi = Math.max(Fa, Fb);
    const cs: number[] = [];
    for (let c = Math.ceil(lo - 0.5) + 0.5; c < hi; c++) if (c > lo) cs.push(c);
    if (Fb < Fa) cs.reverse();
    const za = zOf(a), zb = zOf(b), up = Fb > Fa;
    let l0 = za;
    for (const c of cs) {
      // onde o brilho passa por c (bissecção: o brilho não volta dentro de um trecho)
      let l1 = zb;
      for (let it = 0; it < 12; it++) {
        const zm = (l0 + l1) / 2, v = F(lerpPt(a, b, zm));
        if ((v < c) === up) l0 = zm; else l1 = zm;
      }
      nodes.push(lerpPt(a, b, (l0 + l1) / 2));
      fv.push(c);
    }
    nodes.push(b);
    fv.push(Fb);
  }
  // degraus: cada um com pelo menos 2 px de altura (longe, vários cabem num pixel)
  const runs: { k0: number; k1: number; lv: number }[] = [];
  for (let k = 0; k + 1 < nodes.length; k++) {
    const lv = Math.round((fv[k] + fv[k + 1]) / 2), last = runs[runs.length - 1];
    if (last && (last.lv === lv || nodes[last.k0].y - nodes[k].y < 2)) last.k1 = k + 1;
    else runs.push({ k0: k, k1: k + 1, lv });
  }
  // bordas de cada faixa lateral em cada ponto: cone reto preso ao carro, mais aberto à direita;
  // as faixas de dentro recuam ao menos 2 px por degrau (borda macia em degraus finos)
  const NB = SOFT_T.length;
  const edges = nodes.map((p) => {
    const b = beamAt(tOf(p)), L = b.l * p.w, R = b.r * p.w;
    const sL = Math.max(2, L * 0.1), sR = Math.max(2, R * 0.09);
    const out: number[][] = [];
    for (let i = 0; i < NB; i++) out.push([cx - Math.max(0, L - i * sL), cx + Math.max(0, R - i * sR)]);
    return out;
  });
  g.fillStyle = '#000';
  let x0 = w, x1 = 0, y0 = H0;
  for (const r of runs) if (r.lv > 0) for (let k = r.k0; k <= r.k1; k++) { x0 = Math.min(x0, edges[k][0][0]); x1 = Math.max(x1, edges[k][0][1]); y0 = Math.min(y0, nodes[k].y); }
  beamBox = [Math.max(0, Math.floor(x0) - 1), Math.max(0, Math.floor(y0) - 1), Math.min(w, Math.ceil(x1) + 1), H0];
  for (const r of runs) {
    if (r.lv <= 0) continue;
    const D = r.lv / LEVELS;
    let prev = 0;
    for (let i = 0; i < NB; i++) {
      // alpha desta faixa por cima das de fora, para o total dar SOFT_T[i] x brilho
      const T = SOFT_T[i] * D, a = (T - prev) / Math.max(1e-3, 1 - prev);
      prev = T;
      if (a <= 0.002) continue;
      g.globalAlpha = Math.min(1, a);
      g.beginPath();
      // (os degraus encostam um no outro na mesma linha, sem sobrepor: nada de risco claro)
      const y0 = nodes[r.k0].y + (r.k0 ? 0 : 0.5);
      g.moveTo(edges[r.k0][i][0], y0);
      for (let k = r.k0 + 1; k <= r.k1; k++) g.lineTo(edges[k][i][0], nodes[k].y);
      for (let k = r.k1; k > r.k0; k--) g.lineTo(edges[k][i][1], nodes[k].y);
      g.lineTo(edges[r.k0][i][1], y0);
      g.closePath();
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

// luz de um poste: uma faixa de luz atravessando a pista inteira no trecho do poste (em degraus,
// mais forte embaixo da lâmpada), como nos jogos de corrida em pixel art; só o chão que se vê
const POOL = 6; // meia largura da faixa, em segmentos (luz concentrada embaixo do poste, sem virar névoa)
function streetPool(g: CanvasRenderingContext2D, road: RoadPt[], st: Street, rgb: string, a0: number) {
  // longe (perto da crista ou no fim da reta) a pista fica espremida na tela e as manchas de vários
  // postes se empilham numa faixa amarela contínua: de longe cada mancha pesa menos
  const far = st.d <= 30 ? 1 : Math.max(0.35, 1 - (st.d - 30) / 90);
  for (let k = 0; k + 1 < road.length; k++) {
    const p = road[k], q = road[k + 1];
    if (q.d - p.d > 2) continue; // entre os dois há chão escondido (crista)
    const dd = Math.abs((p.d + q.d) / 2 - st.d);
    if (dd > POOL) continue;
    const a = a0 * st.k * far * (dd <= 1 ? 1 : dd <= 2 ? 0.8 : dd <= 3.5 ? 0.55 : dd <= 5 ? 0.32 : 0.15);
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
// d: distância em segmentos; bx: centro da base na tela; lit: quanto está iluminado (calculado no fim do quadro)
// spec: faixa de metal/refletor (na tela) que brilha com o nosso farol (top: fração de cima mais clara);
// beam: quanto do nosso farol pega o objeto; cone: o quanto ele está dentro do cone, de lado (0..1)
interface Spec { x: number; y: number; w: number; h: number; top: number; rgb: string }
interface Occ { cv: CanvasImageSource; x: number; y: number; w: number; h: number; idx: number; clip: number; d?: number; bx?: number; lit?: number; refl?: Reflector; spec?: Spec; beam?: number; cone?: number }
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
      const bm = beamAt(t);
      const u = (l.x - ox - beamCx) / best.w, half = l.w / 2 / best.w;
      if (u + half > -bm.l && u - half < bm.r) lit = 0.9 * beamFall(t) * coneAt(best) * nearK(best.z ?? best.d);
    }
    for (const st of streets) {
      const dd = Math.abs(best.d - st.d);
      if (dd <= POOL) lit += 0.7 * st.k * (dd <= 1 ? 1 : dd <= 2 ? 0.8 : dd <= 3.5 ? 0.55 : dd <= 5 ? 0.32 : 0.15);
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
// objetos do cenário (e pessoas) que encostam na pista na tela: a luz pintada no chão (nosso facho,
// faixa dos postes, facho dos outros carros, luar) é chão que fica ATRÁS deles; recebem, como os
// carros, uma luz só no corpo inteiro (o), conforme onde está a base deles em relação às luzes
let shadeOcc: Occ[] = [];
function drawOcc(t: CanvasRenderingContext2D, o: Occ, W: number, ox: number, oy: number) {
  if (o.clip < o.y + o.h - 1) {
    // atrás de uma crista: só o que aparece acima dela
    t.save();
    t.beginPath();
    t.rect(0, 0, W, Math.max(0, o.clip - oy + 1));
    t.clip();
    t.drawImage(o.cv, o.x - ox, o.y - oy, o.w, o.h);
    t.restore();
  } else t.drawImage(o.cv, o.x - ox, o.y - oy, o.w, o.h);
}
// Duas máscaras feitas UMA vez por quadro, em lote, do mais longe para o mais perto (o da frente
// cobre o de trás): silAllCv = silhueta de tudo (carros e objetos); litCv = quanto cada um está
// iluminado (alpha = 0,68 x luz no corpo inteiro; na face das placas refletivas, o brilho dela).
// As camadas escura e quente saem das duas com poucas operações de tela inteira (pequena, em pixels
// do jogo), em vez de redesenhar cada silhueta duas ou três vezes por camada.
const litCv = document.createElement('canvas');
const LIT_K = 0.68;
function buildMasks(W: number, H: number, ox: number, oy: number, litCar: (l: Light) => number) {
  const cars = lights.filter((n) => n.shape);
  const items: { idx: number; l?: Light; q?: Sil | null; o?: Occ }[] = [];
  for (const l of cars) items.push({ idx: l.idx === Infinity ? -1 : l.idx + 0.5, l, q: silhouette(l, W, H, ox, oy) });
  for (const o of shadeOcc) items.push({ idx: o.idx, o });
  items.sort((p, q) => q.idx - p.idx);
  for (const cv of [silAllCv, carCv, litCv]) if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const a = silAllCv.getContext('2d')!, t = litCv.getContext('2d')!;
  for (const g of [a, t]) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
  }
  let any = false, anyLit = false;
  const put = (g: CanvasRenderingContext2D, it: (typeof items)[number]) => {
    if (it.o) drawOcc(g, it.o, W, ox, oy);
    else g.drawImage(it.q!.cv, it.q!.sx, it.q!.sy, it.q!.w, it.q!.h, it.q!.x0, it.q!.y0, it.q!.w, it.q!.h);
  };
  // (uma máscara de cada vez: alternar entre as duas a cada objeto custava uma troca de canvas por objeto)
  for (const it of items) if (it.o || it.q) { any = true; put(a, it); }
  for (const it of items) {
    if (!it.o && !it.q) continue;
    const lit = Math.max(0, Math.min(1, it.o ? it.o.lit ?? 0 : litCar(it.l!)));
    // o da frente cobre o de trás: tira a luz do que havia sob a silhueta (só se já há alguma)
    if (anyLit) { t.globalCompositeOperation = 'destination-out'; t.globalAlpha = 1; put(t, it); t.globalCompositeOperation = 'source-over'; }
    if (lit > 0.004) { t.globalAlpha = LIT_K * lit; put(t, it); t.globalAlpha = 1; anyLit = true; }
    // placa refletiva: a face acende com o nosso farol (o que está mais perto passa por cima depois)
    // (mais forte dentro do cone do farol; fora dele, só o pouco que a borda do facho ainda pega)
    if (it.o?.refl) { reflectorFace(t, it.o.refl, ox, oy, 0.3 + 0.7 * (it.o.cone ?? 1)); anyLit = true; }
  }
  if (anyLit) {
    // nada passa do contorno dos objetos
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(silAllCv, 0, 0);
    t.globalCompositeOperation = 'source-over';
  }
  return any;
}
let masksAny = false;
// troca, na camada g, o que há sob as silhuetas por uma cor só: base (opacidade do corpo sem luz)
// menos litCut x luz, ou (base 0) só a luz vezes litAdd
function shadeCars(g: CanvasRenderingContext2D, W: number, H: number, rgb: string, base: number, litCut: number, litAdd: number) {
  if (!masksAny) { g.globalCompositeOperation = 'destination-out'; return; }
  const t = carCv.getContext('2d')!;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, W, H);
  if (base > 0) {
    t.globalAlpha = Math.min(1, base);
    t.drawImage(silAllCv, 0, 0);
    t.globalCompositeOperation = 'destination-out';
    t.globalAlpha = Math.min(1, litCut);
    t.drawImage(litCv, 0, 0);
  } else {
    t.globalAlpha = Math.min(1, litAdd);
    t.drawImage(litCv, 0, 0);
  }
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
// escolhe os objetos que encostam na pista na tela (nas linhas que ocupam, com folga para o
// acostamento e a faixa dos postes) e calcula a luz de cada um: o nosso facho pela posição da base
// (some aos poucos para fora da borda do facho) e a faixa de um poste no trecho dele
function pickOccluders(rd: RoadPt[], ground: RoadPt[], seen: number, ox: number) {
  shadeOcc = [];
  if (roadPoly.length < 2) return;
  const z0 = beamZ0(ground, seen);
  const lastD = ground.length ? ground[ground.length - 1].d : -1;
  const byD = new Map<number, RoadPt>();
  for (const p of rd) byD.set(p.d, p);
  for (const o of occluders) {
    if (o.w * o.h < 12 && !o.refl) continue; // um pontinho ao longe
    const y0 = o.y - 2, y1 = Math.min(o.y + o.h, o.clip) + 2;
    let lo = Infinity, hi = -Infinity, up: RoadPt | null = null, dn: RoadPt | null = null;
    for (const q of roadPoly) {
      if (q.y < y0) { if (!up || q.y > up.y) up = q; continue; }
      if (q.y > y1) { if (!dn || q.y < dn.y) dn = q; continue; }
      lo = Math.min(lo, q.x - q.w * 2); hi = Math.max(hi, q.x + q.w * 2);
    }
    // entre dois trechos da pista (perto da câmera eles ficam longe um do outro na tela)
    if (up && dn) for (const q of [up, dn]) { lo = Math.min(lo, q.x - q.w * 2); hi = Math.max(hi, q.x + q.w * 2); }
    if (!(o.x <= hi && o.x + o.w >= lo) && !o.refl) continue;
    let lit = 0;
    o.beam = 0;
    o.cone = undefined;
    const p = o.d === undefined ? undefined : byD.get(o.d) ?? byD.get(o.d - 1) ?? byD.get(o.d + 1);
    if (p && p.w > 0 && o.bx !== undefined) {
      const u = (o.bx - ox - p.x) / p.w;
      const t = Math.max(0, ((p.z ?? p.d) - z0) / REACH);
      if (p.d <= lastD && t < 1) {
        const bm = beamAt(t);
        const uc = (o.bx - ox - beamCx) / p.w; // em relação à frente do carro (o cone é reto)
        const out = Math.max(0, uc < 0 ? -uc - bm.l : uc - bm.r);
        o.cone = Math.max(0, 1 - out / 0.5);
        lit = 0.9 * beamFall(t) * coneAt(p) * nearK(p.z ?? p.d) * o.cone;
      } else o.cone = 0;
      o.beam = lit;
      for (const st of streets) {
        const dd = Math.abs(p.d - st.d);
        if (dd > POOL) continue;
        const u0 = st.u > 0 ? -1.2 : st.u - 0.3, u1 = st.u > 0 ? st.u + 0.3 : 1.2;
        if (u < u0 - 0.3 || u > u1 + 0.3) continue;
        lit += 0.7 * st.k * (dd <= 1 ? 1 : dd <= 2 ? 0.8 : dd <= 3.5 ? 0.55 : dd <= 5 ? 0.32 : 0.15);
      }
    }
    o.lit = Math.min(1, lit);
    shadeOcc.push(o);
  }
}
const beamCv = document.createElement('canvas');
// faixas de luz dos postes, recortadas pelos objetos do cenário mais perto que cada poste (outdoor,
// placa, árvore na frente do trecho iluminado não ficam pintados de luz). Tudo na própria camada, do
// mais longe para o mais perto: cada objeto apaga a luz dos postes que estão atrás dele (já pintados)
// e os postes mais perto são pintados depois. (Antes: um rascunho de tela inteira por poste.)
function maskedPools(s: CanvasRenderingContext2D, rd: RoadPt[], a0: number) {
  // (os objetos do cenário e os carros que ficam na frente da faixa de luz são repintados por
  // inteiro depois, em shadeCars: antes cada objeto mais perto apagava a luz, um a um)
  // 'lighten': onde as manchas de vários postes caem nas mesmas linhas da tela (crista, fim da reta, pista
  // espremida ao longe) vale a mais forte, em vez de somar até virar uma faixa amarela chapada
  const op = s.globalCompositeOperation;
  s.globalCompositeOperation = 'lighten';
  for (const st of streets) streetPool(s, rd, st, 'rgba(255,200,120,', a0); // (antes 255,190,90: amarelava a pista)
  for (const sp of spots) spotPool(s, rd, sp, Math.min(1, a0 * 3.5));
  s.globalCompositeOperation = op;
}
function secondary(W: number, H: number, ox: number, oy: number, draw: (s: CanvasRenderingContext2D) => void, beam?: (g: CanvasRenderingContext2D, b: Beam) => void) {
  if (!streets.length && !carBeams.length && !spots.length) return null;
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
      // (os objetos do cenário na frente do facho são repintados depois, em shadeCars)
      const list = carBeams;
      for (const b of list) {
        // o facho só ilumina a pista (com um pouco do acostamento): não passa por paredes de
        // túnel, guard-rails, outdoors e o cenário ao lado
        if (roadPoly.length > 1) {
          t.save();
          t.beginPath();
          for (let i = 0; i < roadPoly.length; i++) {
            const q = roadPoly[i];
            if (i) t.lineTo(q.x - q.w * 2.2 - ox, q.y - oy);
            else t.moveTo(q.x - q.w * 2.2 - ox, q.y + 2 - oy);
          }
          for (let i = roadPoly.length - 1; i >= 0; i--) {
            const q = roadPoly[i];
            t.lineTo(q.x + q.w * 2.2 - ox, q.y + (i ? 0 : 2) - oy);
          }
          t.closePath();
          t.clip();
          beam(t, b);
          t.restore();
        } else beam(t, b);
      }
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
  // (os objetos que ficam na frente da pista são repintados depois, em shadeCars)
  t.globalCompositeOperation = 'source-over';
  g.drawImage(beamCv, 0, y0, W, H - y0, 0, y0, W, H - y0);
}
// desenho das luzes de um carro (faróis de quem vem de frente; lanternas, placa e seta de quem vai à frente)
function carLamps(dc: CanvasRenderingContext2D, l: Light, pts: number[][], strength: number) {
  const L = l.x - l.w / 2;
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
}
const lightCv = document.createElement('canvas');
function lightLayer(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number }, strength: number, top: number) {
  if (!lights.length && !streets.length && !fronts.length) return;
  const tf = c.getTransform();
  const DW = c.canvas.width, DH = c.canvas.height;
  type Item = { idx: number; box: number[]; draw: (g: CanvasRenderingContext2D) => void; car?: Light };
  const items: Item[] = [];
  for (const l of lights) {
    const e = l.w * (l.front ? 2.2 : 1.2) + 10, T = l.y - l.h, L = l.x - l.w / 2;
    // lâmpadas atrás de uma crista não aparecem (o carro está escondido pelo morro)
    const pts = l.dots.map(([u, f]) => [L + u * l.w, T + f * l.h]).filter(([, py]) => py <= l.clip + 1);
    items.push({ idx: l.idx === Infinity ? -1 : l.idx, car: l, box: pts.length ? [l.x - e, T - e * 0.6, l.x + e, Math.min(l.y + e * 0.5, l.clip + 1)] : [0, 0, 0, 0], draw: (g) => { if (pts.length) carLamps(g, l, pts, strength); } });
  }
  for (const st of streets) {
    if (st.head > st.clip) continue; // poste atrás do topo de uma subida
    const rx = Math.max(4, st.r * 0.26), ry = Math.max(3, st.r * 0.14);
    items.push({ idx: st.idx < 0 ? -1 : st.idx, box: [st.x - rx - 2, st.head - ry - 2, st.x + rx + 2, Math.min(st.head + ry + 2, st.clip)], draw: (g) => {
      // a lâmpada: um retângulo aceso nítido (como na arte) e um halo pequeno
      blob(g, st.x, st.head, rx, ry, '255,190,100', 0.5 * strength * st.k);
      blob(g, st.x, st.head, Math.max(2, st.r * 0.1), Math.max(1.5, st.r * 0.05), '255,230,170', 0.8 * strength * st.k);
      const lw = Math.max(2, Math.round(st.r * 0.09)), lh = Math.max(1, Math.round(st.r * 0.03));
      g.fillStyle = `rgba(255,244,210,${(0.95 * strength * (0.4 + 0.6 * st.k)).toFixed(3)})`;
      g.fillRect(Math.round(st.x - lw / 2), Math.round(st.head - lh / 2), lw, lh);
    } });
  }
  for (const f of fronts) items.push({ idx: f.idx === Infinity ? -1 : f.idx, box: [f.x - f.w * 2, f.y - f.h * 2, f.x + f.w * 2, Math.min(f.y, f.clip + 1)], draw: (g) => facadeLight(g, f, strength) });
  // caixa de tudo (em pixels do canvas)
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const it of items) { const b = it.box; if (b[2] <= b[0] || b[3] <= b[1]) continue; bx0 = Math.min(bx0, b[0]); by0 = Math.min(by0, b[1]); bx1 = Math.max(bx1, b[2]); by1 = Math.max(by1, b[3]); }
  if (bx1 <= bx0) return;
  bx0 = Math.max(bx0, vp.x); bx1 = Math.min(bx1, vp.x + vp.w); by0 = Math.max(by0, vp.y - 50); by1 = Math.min(by1, vp.y + vp.h + 50);
  // no econômico a camada é feita em meia resolução e ampliada (os brilhos são suaves: quase não se nota)
  // com a tela em 4x a camada é feita em 2x (meio pixel do jogo: os brilhos são suaves e os riscos
  // de 1 pixel do jogo continuam exatos) e ampliada sem suavizar: um quarto dos pixels a pintar e a
  // somar, que é o que mais pesa com muito trânsito de farol aceso (chuva à noite)
  const LS = tf.a >= 4 || (lowFx() && tf.a >= 3) ? 0.5 : 1;
  const LW = Math.ceil(DW * LS), LH = Math.ceil(DH * LS);
  const x0 = Math.max(0, Math.floor((tf.a * bx0 + tf.e) * LS)), x1 = Math.min(LW, Math.ceil((tf.a * bx1 + tf.e) * LS));
  const y0 = Math.max(0, Math.floor((tf.d * by0 + tf.f) * LS)), y1 = Math.min(LH, Math.ceil((tf.d * by1 + tf.f) * LS));
  if (x1 <= x0 || y1 <= y0) return;
  if (lightCv.width !== LW || lightCv.height !== LH) { lightCv.width = LW; lightCv.height = LH; }
  const g = lightCv.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(x0, y0, x1 - x0, y1 - y0);
  g.setTransform(tf.a * LS, 0, 0, tf.d * LS, tf.e * LS, tf.f * LS);
  g.save();
  g.beginPath();
  g.rect(bx0, by0, bx1 - bx0, by1 - by0);
  g.clip();
  // do mais longe para o mais perto; no mesmo trecho: primeiro os objetos (apagam), depois as luzes
  items.sort((p, q) => q.idx - p.idx);
  const scene = occluders.slice().sort((p, q) => q.idx - p.idx);
  const lit: number[][] = []; // caixas das luzes já pintadas (só apaga quem encosta em alguma)
  const hits = (x: number, y: number, w: number, h: number) => { for (const b of lit) if (x < b[2] && x + w > b[0] && y < b[3] && y + h > b[1]) return true; return false; };
  const clipTo = (clip: number) => { if (clip < by1) { g.beginPath(); g.rect(bx0, by0, bx1 - bx0, Math.max(0, clip + 1 - by0)); g.clip(); } };
  let oi = 0;
  const eraseScene = (upTo: number) => {
    for (; oi < scene.length && scene[oi].idx >= upTo; oi++) {
      const o = scene[oi];
      if (!lit.length || !hits(o.x, o.y, o.w, o.h)) continue;
      g.globalCompositeOperation = 'destination-out';
      g.save();
      clipTo(o.clip);
      g.drawImage(o.cv, o.x, o.y, o.w, o.h);
      g.restore();
    }
  };
  for (const it of items) {
    eraseScene(it.idx); // objetos deste trecho e dos que ficam entre ele e o anterior
    const l = it.car;
    if (l?.shape && lit.length && hits(l.x - l.w * 0.75, l.y - l.w * 1.8, l.w * 1.5, l.w * 2)) {
      // a silhueta deste carro tapa as luzes dos que estão atrás dele
      g.globalCompositeOperation = 'destination-out';
      const q = sils.get(l);
      g.save();
      if (q) {
        const sm = g.imageSmoothingEnabled;
        g.imageSmoothingEnabled = false;
        g.drawImage(q.cv, q.sx, q.sy, q.w, q.h, q.x0 + vp.x, q.y0 + top, q.w, q.h);
        g.imageSmoothingEnabled = sm;
      } else { clipTo(l.clip); l.shape(g); }
      g.restore();
    }
    const b = it.box;
    if (b[2] <= b[0] || b[3] <= b[1]) continue;
    g.globalCompositeOperation = 'lighter';
    g.save();
    // atrás de uma crista: só o que fica acima da linha da crista aparece
    g.beginPath();
    g.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    g.clip();
    it.draw(g);
    g.restore();
    lit.push(b);
  }
  eraseScene(-Infinity); // o que está mais perto que todas as luzes
  g.restore();
  g.globalCompositeOperation = 'source-over';
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = LS < 1 && tf.a < 4;
  c.drawImage(lightCv, x0, y0, x1 - x0, y1 - y0, x0 / LS, y0 / LS, (x1 - x0) / LS, (y1 - y0) / LS);
  c.restore();
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
    spots.length = 0;
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
  aimSteer += (Math.max(-1, Math.min(1, steer)) - aimSteer) * 0.2;
  beamPitch = pitch;
  beamCx = cx;
  beamSeg = segLen;
  beamShape(g, W, cx, seen - top, ground, 0.85);
  pickOccluders(rd, ground, seen - top, vp.x);
  // postes acesos e faróis de quem vai à frente: luz só no chão, numa camada à parte da qual as
  // silhuetas dos carros são apagadas (a mancha de luz não passa por cima de nenhum carro)
  // UMA camada só para as duas coisas: a luz quente (sódio dos postes e farol de quem vai à frente,
  // já recortada pelos objetos e sem os carros) é feita aqui e serve também para abrir a escuridão:
  // quatro passadas dela apagando o escuro dão o mesmo clarão de antes (postes ~0,6, faróis ~1) sem
  // montar uma segunda camada igual, que era o que mais pesava à noite
  const secW = secondary(W, H, vp.x, top, (s) => {
    maskedPools(s, rd, 0.2 * strength);
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
  masksAny = buildMasks(W, H, vp.x, top, litOf);
  // corpo sem luz: 0,8 da escuridão; com luz: 0,8 x (1 - 0,68 x luz); face de placa: 0,8 x (1 - brilho)
  shadeCars(g, W, H, 'rgb(0,0,10)', 0.8 * strength, 1, 0);
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
  beamShape(wg, W, cx, seen - top, ground, 0.34);
  wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = 'rgb(255,226,160)';
  if (beamBox[2] > beamBox[0] && beamBox[3] > beamBox[1]) wg.fillRect(beamBox[0], beamBox[1], beamBox[2] - beamBox[0], beamBox[3] - beamBox[1]); // (a camada só tem o facho, dentro desse retângulo)
  wg.globalCompositeOperation = 'source-over';
  // luz de sódio dos postes e farol de quem vai à frente, sem pintar os carros
  if (secW) wg.drawImage(secW, 0, 0);
  // apaga o facho e a luz do poste pintados no chão por baixo de cada carro (no baú alto do
  // caminhão eles apareciam em degraus) e dá ao carro inteiro uma luz só
  shadeCars(wg, W, H, 'rgb(255,226,160)', 0, 0, 0.1 / LIT_K); // (a face das placas ganha o tom quente do farol)
  // brilho do farol na lâmina do guard-rail e no refletor das balizas (do mais longe para o mais perto)
  wg.globalCompositeOperation = 'source-over';
  for (const o of shadeOcc) {
    const sp = o.spec, k = o.beam ?? 0;
    if (!sp || k < 0.03) continue;
    const x = sp.x - vp.x, y = sp.y - top, h = Math.min(sp.h, o.clip - sp.y + 1);
    if (h <= 0) continue;
    wg.fillStyle = `rgba(${sp.rgb},${Math.min(1, 0.08 * k).toFixed(3)})`;
    wg.fillRect(x, y, sp.w, h);
    wg.fillStyle = `rgba(${sp.rgb},${Math.min(1, 0.26 * k).toFixed(3)})`;
    wg.fillRect(x, y, sp.w, Math.min(h, Math.max(0.5, sp.h * sp.top)));
  }
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
  // TODAS as luzes acesas (lâmpadas dos postes, fachadas, faróis e lanternas dos carros) numa
  // camada só, do mais longe para o mais perto: antes das luzes de cada trecho, os objetos do
  // cenário e os carros desse trecho apagam da camada as luzes do que está atrás deles (pela
  // silhueta, pixel a pixel). No fim a camada é somada à tela de uma vez. (Antes: um rascunho por
  // lâmpada, por fachada e por carro, cada um com o seu vaivém de canvas.)
  refl.length = 0;
  lightLayer(c, vp, strength, top);
  fronts.length = 0;
  streets.length = 0;
  spots.length = 0;
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
// luzinhas da obra (pisca âmbar dos cavaletes, giroflex da máquina, semáforo): halo somado por cima
// da escuridão; list: [x, y, raio, força] na tela
export function beaconGlow(c: CanvasRenderingContext2D, list: number[][], rgb: string, strength: number) {
  if (strength <= 0.02 || !list.length) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of list) {
    blob(c, x, y, r * 3.2, r * 2.4, rgb, 0.55 * a * strength);
    blob(c, x, y, r * 1.2, r, rgb, 0.9 * a * strength);
  }
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
// para os testes automatizados (cintilação do facho): as camadas da noite do último quadro
export const nightLayers = () => ({ dark: darkCv, warm: warmCv, beamBuilds });
