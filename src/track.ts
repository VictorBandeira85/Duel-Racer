import { LANE_W, SEG_LEN } from './config';
import type { StageDef } from './courses';
import { SPRITES, type SpriteKind } from './sprites';
import type { Theme } from './themes';
import { easeIn, easeInOut, rng } from './util';

export interface Point {
  world: { y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
}

export interface SpriteInst {
  kind: SpriteKind;
  x: number; // centro, em unidades do mundo (0 = meio da pista)
  seed: number;
}

export interface Segment {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  sprites: SpriteInst[];
  cars: { z: number; x: number }[];
  clip: number;
}

export interface Track {
  segments: Segment[];
  roadW: number; // meia largura da pista
  lanes: number;
  startZ: number;
  finishZ: number;
  policeSpots: number[];
}

const point = (y: number, z: number): Point => ({
  world: { y, z },
  camera: { x: 0, y: 0, z: 0 },
  screen: { x: 0, y: 0, w: 0, scale: 0 },
});

export function laneCenter(track: Track, lane: number) {
  const lw = (track.roadW * 2) / track.lanes;
  return -track.roadW + lw * (lane + 0.5);
}

export function buildTrack(def: StageDef, theme: Theme, seed: number): Track {
  const rand = rng(seed);
  const roadW = (def.lanes * LANE_W) / 2;
  const segments: Segment[] = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);

  const addSegment = (curve: number, y: number) => {
    const n = segments.length;
    segments.push({ index: n, p1: point(lastY(), n * SEG_LEN), p2: point(y, (n + 1) * SEG_LEN), curve, sprites: [], cars: [], clip: 0 });
  };

  const addRoad = (enter: number, hold: number, leave: number, curve: number, height: number) => {
    const startY = lastY();
    const endY = startY + height * SEG_LEN;
    const total = enter + hold + leave;
    const first = segments.length;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    if (Math.abs(curve) >= 3) {
      for (let i = 0; i < 3; i++) {
        const s = segments[first + Math.max(0, enter - 24) + i * 7];
        const x = (roadW + 1400) * (curve > 0 ? -1 : 1);
        if (s) s.sprites.push({ kind: curve > 0 ? 'signR' : 'signL', x, seed: 0 });
      }
    }
  };

  const hill = () => {
    if (rand() > def.hilliness) return 0;
    return (rand() * 2 - 1) * 50 * def.hilliness - lastY() / SEG_LEN / 3;
  };

  addRoad(0, 60, 0, 0, 0);
  const startIndex = 8;

  for (let i = 0; i < def.sections; i++) {
    const r = rand();
    const len = [30, 50, 80][Math.floor(rand() * 3)];
    const curve = (rand() < 0.5 ? -1 : 1) * [1.5, 2.5, 4][Math.floor(rand() * 3)] * def.curviness;
    if (r < 0.35) addRoad(len, len * 2, len, 0, hill());
    else if (r < 0.8) addRoad(len, len, len, curve, hill());
    else {
      addRoad(len, len, len, curve, hill() / 2);
      addRoad(len, len, len, -curve, hill() / 2);
    }
  }

  addRoad(40, 60, 40, 0, -lastY() / SEG_LEN);
  const finishIndex = segments.length + 20;
  addRoad(0, 300, 0, 0, 0);

  // balizas brancas dos dois lados
  for (let i = 0; i < segments.length; i += 8) {
    segments[i].sprites.push({ kind: 'post', x: -(roadW + 900), seed: 0 }, { kind: 'post', x: roadW + 900, seed: 0 });
  }

  // posto de gasolina na chegada
  for (const k of [60, 35]) segments[finishIndex - k].sprites.push({ kind: 'gasSign', x: roadW + 2200, seed: 0 });
  segments[finishIndex + 4].sprites.push({ kind: 'station', x: roadW + 5200, seed: 0 });

  // cenário
  for (let i = 20; i < segments.length; i++) {
    const s = segments[i];
    if (rand() < theme.density) {
      const side = rand() < 0.5 ? -1 : 1;
      const kind = theme.scenery[Math.floor(rand() * theme.scenery.length)];
      const half = SPRITES[kind].w / 2;
      const x = side * (roadW + 1600 + half + rand() * (rand() < 0.2 ? 9000 : 3000));
      s.sprites.push({ kind, x, seed: Math.floor(rand() * 1e6) });
    }
  }

  // pontos onde a polícia fica escondida
  const policeSpots: number[] = [];
  for (let i = 0; i < def.police; i++) {
    const t = 0.25 + (0.55 * (i + rand() * 0.6)) / Math.max(1, def.police);
    policeSpots.push(Math.floor(startIndex + (finishIndex - startIndex) * t) * SEG_LEN);
  }

  return { segments, roadW, lanes: def.lanes, startZ: startIndex * SEG_LEN, finishZ: finishIndex * SEG_LEN, policeSpots };
}
