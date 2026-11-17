import { LANE_W, SEG_LEN } from './config';
import { BLITZ_SIGNS_M, HORSE_W, coneLine, type Closure, type Cone } from './blitz';
import type { Segment, Track } from './track';
import { rng } from './util';

// Obra na pista: em parte dos trechos (no máximo uma, escolhida pela seed) uma faixa da direita fica
// fechada por ~150-250 m. Placas OBRAS 500 m e DESVIO avisam antes; cones afunilam a faixa, cavaletes
// listrados (com pisca âmbar no alto) e barris seguem a linha, e dentro da área fechada há montes de
// terra e brita, uma máquina amarela parada (rolo compactador ou retroescavadeira, vista de trás) e o
// asfalto escuro, fresado e remendado. Na entrada, o sinaleiro (homem ou mulher) acena com a bandeira. Em
// mão dupla é pare-e-siga: a nossa faixa fecha inteira, passamos pela contramão e quem vem de lá
// espera parado antes da obra (semáforo verde do nosso lado). A física dos cones, o desvio do
// trânsito e do rival são os da blitz (src/blitz.ts: Closure).

const SEG_M = (SEG_LEN * 0.025) / 3.6; // metros por segmento
export const OBRA_SIGNS_M = [500, 220]; // placas OBRAS 500 m e DESVIO antes do começo dos cones
const TAPER = 40; // segmentos do afunilado (fecha e abre)

// enfeites parados da área fechada: montes de terra e brita, a máquina e o semáforo do pare-e-siga
export type PropKind = 'dirt' | 'gravel' | 'roller' | 'digger' | 'light';
export interface ObraProp { obraProp: PropKind; z: number; x: number; seed: number }
// sinaleiro (homem ou mulher da obra) com a bandeira vermelha, na entrada
export interface Flagman { flagman: true; z: number; x: number; woman: boolean }

export interface Obra extends Closure {
  props: ObraProp[];
  flag: Flagman;
  two: boolean; // mão dupla: pare-e-siga (a contramão espera em holdZ)
  holdZ: number;
}

// tamanho no mundo (largura, altura) dos enfeites, na escala dos carros (CAR_W 1100 = 1,8 m: ~600 por
// metro) e na proporção da arte (src/obraart.ts): monte de terra 1,2 m de altura, de brita 1 m,
// retroescavadeira 3,1 m (lança dobrada no alto; 2,5 m de largura), rolo 2,9 x 2,2 m, semáforo 2,5 m
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  dirt: [1550, 720], gravel: [1300, 620], roller: [1345, 1750], digger: [1505, 1860], light: [555, 1500],
};
// sinaleiro: 1,7 m do pé ao alto do capacete (150 px da arte); a imagem é mais alta (bandeira erguida)
export const FLAG_BODY_H = 1020;
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
    // nem em curva fechada (o afunilado e a faixa fechada pedem pista que se vê de longe)
    if (track.segments.slice(i - 60, i + span).some((sg) => Math.abs(sg.curve) >= 4.5)) continue;
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
    // homem ou mulher (sorteio próprio da seed, para não mudar o resto da obra)
    flag: { flagman: true, z: z1 - 8 * SEG_LEN, x: 0, woman: rng(seed * 31 + 7)() < 0.5 },
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
