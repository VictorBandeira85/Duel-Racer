import { LANE_W, SEG_LEN } from './config';
import { BLITZ_SIGNS_M, HORSE_W, coneLine, drawWorkSign, type Closure, type Cone } from './blitz';
import type { Segment, Track } from './track';
import { rng } from './util';

// Obra na pista: em parte dos trechos (no máximo uma, escolhida pela seed) uma faixa da direita fica
// fechada por ~150-250 m. Placas OBRAS 500 m e DESVIO avisam antes; cones afunilam a faixa, cavaletes
// listrados (com pisca âmbar no alto) e barris seguem a linha, e dentro da área fechada há montes de
// terra e brita, uma máquina amarela parada (rolo compactador ou retroescavadeira, vista de trás) e o
// asfalto escuro, fresado e remendado. Na entrada, um homem da obra balança a bandeira vermelha. Em
// mão dupla é pare-e-siga: a nossa faixa fecha inteira, passamos pela contramão e quem vem de lá
// espera parado antes da obra (semáforo verde do nosso lado). A física dos cones, o desvio do
// trânsito e do rival são os da blitz (src/blitz.ts: Closure).

const SEG_M = (SEG_LEN * 0.025) / 3.6; // metros por segmento
export const OBRA_SIGNS_M = [500, 220]; // placas OBRAS 500 m e DESVIO antes do começo dos cones
const TAPER = 40; // segmentos do afunilado (fecha e abre)

// enfeites parados da área fechada: montes de terra e brita, a máquina e o semáforo do pare-e-siga
export type PropKind = 'dirt' | 'gravel' | 'roller' | 'digger' | 'light';
export interface ObraProp { obraProp: PropKind; z: number; x: number; seed: number }
// homem da obra com a bandeira vermelha, na entrada
export interface Flagman { flagman: true; z: number; x: number }

export interface Obra extends Closure {
  props: ObraProp[];
  flag: Flagman;
  two: boolean; // mão dupla: pare-e-siga (a contramão espera em holdZ)
  holdZ: number;
}

// tamanho no mundo (largura, altura) dos enfeites
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  dirt: [1700, 700], gravel: [1400, 560], roller: [1350, 1750], digger: [1500, 2000], light: [420, 1900],
};
export const FLAG_W = 1100, FLAG_H = 1400; // homem da bandeira (~1,75 m; sprite com folga para a bandeira balançando)
export const SOLID_PROPS: PropKind[] = ['roller', 'digger']; // bater na máquina é batida de verdade

// começo da obra (z onde os cones começam a fechar) ou undefined: ~40% dos trechos, nunca no começo
// nem perto da chegada, de túnel, da blitz ou de um ponto de polícia (sorteio próprio da seed)
export function pickObra(track: Pick<Track, 'segments' | 'startZ' | 'finishZ' | 'policeSpots' | 'blitz'>, seed: number) {
  const r = rng(seed * 17 + 53);
  if (r() > 0.4) return undefined;
  const back = Math.round(OBRA_SIGNS_M[0] / SEG_M) + 25, span = 330; // placas antes; cones e área depois
  const i0 = Math.floor(track.startZ / SEG_LEN) + 420, i1 = Math.floor(track.finishZ / SEG_LEN) - 260 - span;
  if (i1 <= i0) return undefined;
  const bz = track.blitz !== undefined ? Math.floor(track.blitz / SEG_LEN) : NaN;
  const bBack = Math.round(BLITZ_SIGNS_M[0] / SEG_M) + 60;
  const first = i0 + Math.floor(r() * (i1 - i0));
  for (let k = 0; k < i1 - i0; k += 37) {
    const i = i0 + ((first - i0 + k) % (i1 - i0));
    if (track.segments.slice(i - back, i + span + 20).some((sg) => sg.tunnel)) continue;
    // blitz: nem as placas de uma podem cair dentro da outra
    if (bz === bz && i + span + 80 > bz - bBack && i - back - 60 < bz + 40) continue;
    if (track.policeSpots.some((z) => z / SEG_LEN > i - back && z / SEG_LEN < i + span + 30)) continue;
    return i * SEG_LEN;
  }
  return undefined;
}

export function makeObra(track: Track, z: number, seed: number): Obra {
  const r = rng(seed * 7 + 11);
  const R = track.roadW, two = track.lanes < 4;
  // quatro faixas: fecha a da direita inteira; mão dupla: a nossa faixa inteira (passa-se pela contramão)
  const inner = two ? 260 : R - LANE_W + 200;
  const outer = R + 450;
  const len = Math.round((150 + r() * 100) / SEG_M);
  const z0 = z, z1 = z + TAPER * SEG_LEN, z2 = z1 + len * SEG_LEN, z3 = z2 + (TAPER - 12) * SEG_LEN;
  const o: Obra = {
    inner, outer, z0, z1, z2, z3, cones: [], props: [], pad: HORSE_W / 2, two, holdZ: z3 + 22 * SEG_LEN,
    // na entrada, de frente para quem chega
    flag: { flagman: true, z: z1 - 8 * SEG_LEN, x: 0 },
  };
  o.flag.x = R + 650; // no acostamento, fora do caminho de quem entra na faixa fechada
  const cone = (cz: number, x: number, kind?: Cone['kind']): Cone =>
    ({ cone: true, z: cz, x, y: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, hit: false, ...(kind ? { kind } : {}) });
  // afunilado: só cones; no trecho fechado: cavalete, cone, barril, cone...
  let k = 0;
  for (let cz = z0; cz <= z3 + 1; cz += 3 * SEG_LEN) {
    const closed = cz >= z1 && cz <= z2;
    const kind = !closed ? undefined : k % 4 === 0 ? 'horse' : k % 4 === 2 ? 'barrel' : undefined;
    if (closed) k++;
    o.cones.push(cone(cz, coneLine(o, cz), kind));
  }
  // barreira de cavaletes atravessada na faixa logo depois do afunilado
  for (let x = inner + HORSE_W; x < outer - HORSE_W / 2; x += HORSE_W + 90) o.cones.push(cone(z1 + 2 * SEG_LEN, x, 'horse'));
  // dentro da área fechada: montes, barris soltos e a máquina (meio da largura fechada)
  const mid = (inner + Math.min(outer, R)) / 2 + 150;
  const at = (f: number) => z1 + Math.round(len * f) * SEG_LEN;
  const s = () => Math.floor(r() * 1e6);
  o.props.push({ obraProp: 'dirt', z: at(0.18), x: mid + 100, seed: s() });
  o.props.push({ obraProp: r() < 0.5 ? 'roller' : 'digger', z: at(0.42), x: mid, seed: s() });
  o.props.push({ obraProp: 'gravel', z: at(0.62), x: mid - 80, seed: s() });
  o.props.push({ obraProp: 'dirt', z: at(0.82), x: mid + 60, seed: s() });
  o.cones.push(cone(at(0.3), mid + 400, 'barrel'), cone(at(0.31), mid - 250, 'barrel'), cone(at(0.7), mid + 350, 'barrel'));
  // pare-e-siga: semáforo do nosso lado, no acostamento, verde (a contramão é que espera)
  if (two) o.props.push({ obraProp: 'light', z: z0 - 6 * SEG_LEN, x: R + 900, seed: 0 });
  return o;
}

// trecho com o asfalto da obra (fresado e remendado)
export const inObra = (o: Obra | null | undefined, s: Segment) => !!o && s.index * SEG_LEN >= o.z0 - 4 * SEG_LEN && s.index * SEG_LEN <= o.z3 + 4 * SEG_LEN;

// ---- desenho (pixel art em grade: cada célula é um "pixel" do sprite) ----
type P = (gx: number, gy: number, gw: number, gh: number, col: string) => void;
function grid(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols: number, rows: number): P {
  const L = x - w / 2, T = y - h, cw = w / cols, rh = h / rows;
  return (gx, gy, gw, gh, col) => {
    c.fillStyle = col;
    c.fillRect(L + gx * cw, T + gy * rh, gw * cw, gh * rh);
  };
}
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// cavalete de obra: duas tábuas listradas laranja/branco em diagonal sobre pés de ferro, com o
// pisca âmbar no alto à esquerda (apagado no sprite: o jogo acende por cima, piscando)
export function drawHorse(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const p = grid(c, x, y, w, h, 22, 20);
  // pisca
  p(2, 0, 4, 3, '#16161a');
  p(3, 1, 2, 1, '#8a5a12');
  p(3, 3, 2, 1, '#6a6a72');
  // pés em A (ferro) e a travessa de baixo
  for (const [a, b] of [[1, 3], [17, 19]]) {
    p(a, 4, 2, 16, '#55555c');
    p(a, 4, 1, 16, '#9a9aa2');
    p(b - 1, 15, 2, 5, '#55555c');
  }
  p(1, 18, 20, 1, '#3a3a40');
  // tábuas listradas
  const board = (y0: number, hh: number) => {
    p(0, y0, 22, hh, '#16161a');
    for (let gy = y0 + 1; gy < y0 + hh - 1; gy++) {
      for (let gx = 1; gx < 21; gx++) {
        const band = Math.floor((gx + (gy - y0)) / 3) % 2;
        p(gx, gy, 1, 1, band ? '#f4f4f0' : '#f26a12');
      }
    }
    p(1, y0 + hh - 2, 20, 1, 'rgba(0,0,0,0.22)'); // sombra embaixo da tábua
    p(1, y0 + 1, 20, 1, 'rgba(255,255,255,0.18)'); // luz em cima
  };
  board(4, 6);
  board(11, 5);
}

// barril de obra: laranja com duas faixas brancas refletivas, borda escura em cima e base preta
export function drawBarrel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const p = grid(c, x, y, w, h, 10, 16);
  p(1, 15, 8, 1, '#16161a');
  p(0, 14, 10, 1, '#26262c');
  p(1, 1, 8, 13, '#f26a12');
  p(0, 3, 10, 10, '#f26a12');
  p(6, 1, 3, 13, '#b8440a');
  p(9, 3, 1, 10, '#b8440a');
  p(1, 2, 1, 11, '#ff9a40');
  for (const gy of [4, 9]) {
    p(0, gy, 10, 2, '#f4f4f0');
    p(6, gy, 4, 2, '#b4b4b8');
  }
  p(2, 0, 6, 1, '#c85010');
  p(1, 1, 8, 1, '#d85a14');
}

// monte de terra (ou de brita): degraus de pixel, luz à esquerda e sombra à direita, pedrinhas
export function drawPile(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, gravel: boolean) {
  const cols = 24, rows = 10;
  const p = grid(c, x, y, w, h, cols, rows);
  const pal = gravel ? ['#c4c2ba', '#9a9890', '#77756e', '#55534e', '#e0ded6'] : ['#a87a4a', '#86603a', '#664628', '#48301a', '#c09060'];
  for (let gy = 0; gy < rows; gy++) {
    const t = (gy + 1) / rows; // 0 no topo, 1 na base
    const hw = Math.round((cols / 2) * Math.min(1, Math.sqrt(t) * 1.05));
    const x0 = cols / 2 - hw, x1 = cols / 2 + hw;
    for (let gx = x0; gx < x1; gx++) {
      const u = (gx - x0) / Math.max(1, x1 - x0);
      let col = u < 0.3 ? pal[0] : u < 0.62 ? pal[1] : u < 0.85 ? pal[2] : pal[3];
      const hh = hash(seed + gx * 31 + gy * 17);
      if (hh > 0.86) col = gravel ? pal[4] : pal[3];
      else if (hh < 0.08) col = pal[gravel ? 3 : 4];
      p(gx, gy, 1, 1, col);
    }
  }
  p(1, rows - 1, cols - 2, 1, pal[3]); // pé do monte na sombra
}

// rolo compactador visto de trás: pneus grandes, capô amarelo com grade, cabine aberta (santantônio
// preto, banco), teto e o giroflex âmbar no alto
export function drawRoller(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const p = grid(c, x, y, w, h, 26, 34);
  const Y = '#e8b418', YL = '#f6d04a', YD = '#a87c0c', K = '#16161a';
  p(11, 0, 4, 2, '#d88a10'); p(12, 0, 1, 1, '#ffd070'); // giroflex (apagado: aceso pelo jogo)
  p(3, 2, 20, 2, Y); p(3, 2, 20, 1, YL); p(3, 4, 20, 1, YD); // teto
  p(4, 5, 2, 13, K); p(20, 5, 2, 13, K); // santantônio
  p(6, 5, 14, 13, '#5c7280'); p(6, 5, 14, 2, '#7d94a2'); // vista pela cabine (cor de vidro, céu)
  p(9, 9, 8, 7, '#2a2a30'); p(10, 10, 6, 5, '#3c3c44'); // encosto do banco
  p(18, 10, 1, 8, '#2a2a2a'); p(18, 9, 2, 1, '#2a2a2a'); // escapamento
  p(2, 18, 22, 9, Y); p(2, 18, 22, 1, YL); p(2, 18, 1, 9, YL); p(21, 19, 3, 8, YD); // capô
  for (let gy = 20; gy < 25; gy += 2) p(8, gy, 10, 1, K); // grade
  p(3, 25, 2, 1, '#c01818'); p(21, 25, 2, 1, '#c01818'); // lanternas
  for (let gx = 2; gx < 24; gx += 2) p(gx, 27, 1, 2, (gx >> 1) % 2 ? K : Y); // para-choque zebrado
  p(2, 27, 22, 1, YD);
  // pneus (sulcos)
  for (const x0 of [0, 20]) {
    p(x0, 22, 6, 12, '#1c1c1e');
    for (let gy = 23; gy < 34; gy += 2) p(x0 + 1, gy, 4, 1, '#2e2e32');
    p(x0, 22, 1, 12, '#3a3a3e');
  }
  p(6, 29, 14, 4, '#26262a');
  p(6, 33, 14, 1, '#111');
}

// retroescavadeira vista de trás: a lança dobrada para cima no meio, com a caçamba no alto, cabine
// de vidro atrás dela, sapatas de apoio dos lados e os pneus traseiros grandes
export function drawDigger(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const p = grid(c, x, y, w, h, 28, 38);
  const Y = '#e8b418', YL = '#f6d04a', YD = '#a87c0c', K = '#16161a';
  // cabine atrás da lança
  p(4, 6, 20, 1, K); p(5, 5, 18, 1, Y); p(5, 4, 18, 1, YL); // teto
  p(5, 7, 18, 13, '#5c7280'); p(5, 7, 18, 3, '#7d94a2'); // vidros (cor de vidro)
  p(4, 7, 1, 13, K); p(23, 7, 1, 13, K); p(13, 7, 2, 13, '#22262a');
  p(19, 3, 2, 1, '#d88a10'); // giroflex (apagado)
  // lança e braço dobrados, com a caçamba em cima
  p(11, 0, 6, 4, '#5a5a60'); p(11, 3, 6, 1, '#3a3a40'); for (let gx = 11; gx < 17; gx += 2) p(gx, 4, 1, 1, '#3a3a40'); // caçamba e dentes
  p(12, 4, 4, 22, Y); p(12, 4, 1, 22, YL); p(15, 4, 1, 22, YD);
  p(11, 14, 6, 2, YD); p(13, 15, 2, 1, '#5a5a60'); // articulação
  p(13, 18, 1, 8, '#9a9aa2'); // pistão
  // corpo
  p(2, 20, 24, 8, Y); p(2, 20, 24, 1, YL); p(22, 21, 4, 7, YD);
  p(3, 26, 2, 1, '#c01818'); p(23, 26, 2, 1, '#c01818');
  // sapatas de apoio
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 0 : 26;
    p(x0, 24, 2, 11, Y); p(x0 + (s < 0 ? 0 : 1), 24, 1, 11, s < 0 ? YL : YD);
    p(s < 0 ? 0 : 25, 35, 3, 2, '#3a3a40');
  }
  // pneus
  for (const x0 of [2, 20]) {
    p(x0, 25, 6, 13, '#1c1c1e');
    for (let gy = 26; gy < 38; gy += 2) p(x0 + 1, gy, 4, 1, '#2e2e32');
    p(x0, 25, 1, 13, '#3a3a3e');
  }
  p(8, 30, 12, 4, '#26262a');
  p(8, 37, 12, 1, '#111');
}

// semáforo portátil do pare-e-siga: caixa preta com as três lentes (o verde aceso) num poste com base
export function drawWorkLight(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const p = grid(c, x, y, w, h, 6, 26);
  p(0, 24, 6, 2, '#26262c'); p(0, 24, 6, 1, '#3a3a40'); // base
  p(2, 12, 2, 12, '#6a6a72'); p(2, 12, 1, 12, '#a4a4ac'); // poste
  p(0, 0, 6, 12, '#16161a');
  p(1, 1, 4, 3, '#4a1210'); p(1, 4.5, 4, 3, '#4a3410'); // vermelho e amarelo apagados
  p(1, 8, 4, 3, '#38e070'); p(2, 8, 2, 1, '#b0ffc8'); // verde aceso
  p(0, 0, 6, 1, '#f26a12'); // faixa laranja da obra em cima
}

// homem da obra: capacete branco, colete laranja com faixas refletivas, calça escura e a bandeira
// vermelha balançando na mão direita (frame: ângulo do braço, em radianos)
export function drawFlagman(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ang: number) {
  // pixel quadrado: 34 linhas na altura do sprite, o corpo nas 28 de baixo (8 colunas no meio); o
  // resto é a folga do braço com a bandeira
  const u = h / 34;
  const p = grid(c, x, y, 8 * u, 28 * u, 8, 28);
  p(2, 26, 2, 2, '#1a1a1a'); p(4, 26, 2, 2, '#1a1a1a'); // botas
  p(2, 16, 2, 10, '#2a3048'); p(4, 16, 2, 10, '#232840'); p(2, 16, 4, 1, '#1a1e30'); // calça
  p(1, 7, 6, 9, '#f26a12'); p(5, 7, 2, 9, '#c4500e'); // colete
  p(1, 10, 6, 1, '#e8e8e0'); p(1, 13, 6, 1, '#e8e8e0'); // faixas refletivas
  p(0, 8, 1, 7, '#f26a12'); p(0, 15, 1, 1, '#c08860'); // braço esquerdo caído e a mão
  p(3, 3, 2, 4, '#c08860'); p(4, 3, 1, 4, '#9a6a48'); // rosto
  p(2, 1, 4, 2, '#f0f0ea'); p(1, 3, 6, 1, '#d8d8d0'); p(5, 1, 1, 2, '#c8c8c0'); // capacete
  // braço direito levantado (do ombro), com o cabo e a bandeira
  const sx = x + 3 * u, sy = y - 20 * u;
  c.save();
  c.translate(sx, sy);
  c.rotate(ang);
  c.fillStyle = '#f26a12';
  c.fillRect(0, u, u, -u * 4); // braço (manga do colete)
  c.fillStyle = '#c08860';
  c.fillRect(0, -u * 3, u, -u); // mão
  c.fillStyle = '#6a4a2a';
  c.fillRect(u * 0.3, -u * 3.5, u * 0.45, -u * 6.5); // cabo
  c.fillStyle = '#d01818';
  c.fillRect(u * 0.75, -u * 10, u * 4, u * 3); // bandeira
  c.fillStyle = '#a00c0c';
  c.fillRect(u * 0.75, -u * 7.8, u * 4, u * 0.8); // dobra de baixo e a ponta na sombra
  c.fillRect(u * 3.9, -u * 10, u * 0.85, u * 3);
  c.fillStyle = '#ff4a3a';
  c.fillRect(u * 0.75, -u * 10, u * 3, u * 0.6); // luz em cima
  c.restore();
}

// placas de aviso da obra (mesma placa laranja da blitz)
export const drawObrasSign = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => drawWorkSign(c, x, y, w, h, 'OBRAS', '500 m');
export const drawDesvioSign = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => drawWorkSign(c, x, y, w, h, 'DESVIO', '', -1);
