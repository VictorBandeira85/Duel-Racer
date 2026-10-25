import { SEG_LEN, RUMBLE } from './config';
import type { Stage } from './stages';
import { SPRITES, type SpriteKind } from './sprites';
import { easeIn, easeInOut, rng } from './util';

export interface Point {
  world: { y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
}

export interface SpriteInst {
  kind: SpriteKind;
  offset: number; // centro do objeto, em meias larguras de pista
  seed: number;
}

export interface Segment {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  dark: boolean;
  checker: boolean;
  sprites: SpriteInst[];
  cars: { z: number }[];
  clip: number;
}

export interface Track {
  segments: Segment[];
  startZ: number;
  finishZ: number;
}

const point = (y: number, z: number): Point => ({
  world: { y, z },
  camera: { x: 0, y: 0, z: 0 },
  screen: { x: 0, y: 0, w: 0, scale: 0 },
});

export function buildTrack(stage: Stage): Track {
  const rand = rng(stage.seed);
  const segments: Segment[] = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);

  const addSegment = (curve: number, y: number) => {
    const n = segments.length;
    segments.push({
      index: n,
      p1: point(lastY(), n * SEG_LEN),
      p2: point(y, (n + 1) * SEG_LEN),
      curve,
      dark: Math.floor(n / RUMBLE) % 2 === 1,
      checker: false,
      sprites: [],
      cars: [],
      clip: 0,
    });
  };

  const addRoad = (enter: number, hold: number, leave: number, curve: number, height: number) => {
    const startY = lastY();
    const endY = startY + height * SEG_LEN;
    const total = enter + hold + leave;
    const first = segments.length;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    // placas de curva perigosa, no lado de fora da curva
    if (Math.abs(curve) >= 4) {
      for (let i = 0; i < 3; i++) {
        const s = segments[first + Math.max(0, enter - 30) + i * 8];
        if (s) s.sprites.push({ kind: curve > 0 ? 'signR' : 'signL', offset: curve > 0 ? -1.45 : 1.45, seed: 0 });
      }
    }
  };

  // Altura tende a voltar ao nível zero para a pista não "fugir" para o céu
  const hill = () => {
    if (rand() > stage.hilliness) return 0;
    const raw = (rand() * 2 - 1) * 60 * stage.hilliness;
    return raw - lastY() / SEG_LEN / 3;
  };

  addRoad(0, 80, 0, 0, 0);
  const startIndex = 10;

  for (let i = 0; i < stage.sections; i++) {
    const r = rand();
    const len = [25, 50, 75][Math.floor(rand() * 3)];
    const dir = rand() < 0.5 ? -1 : 1;
    const curve = dir * [2, 4, 6][Math.floor(rand() * 3)] * stage.curviness;
    if (r < 0.22) addRoad(len, len, len, 0, hill());
    else if (r < 0.68) addRoad(len, len, len, curve, hill());
    else if (r < 0.86) {
      addRoad(len, len, len, curve, hill() / 2);
      addRoad(len, len, len, -curve, hill() / 2);
    } else {
      for (let k = 0; k < 4; k++) addRoad(10, 10, 10, 0, (rand() < 0.5 ? -1 : 1) * (5 + rand() * 15) * stage.hilliness);
    }
  }

  addRoad(30, 40, 30, 0, -lastY() / SEG_LEN);
  const finishIndex = segments.length + 10;
  addRoad(0, 400, 0, 0, 0);

  for (const idx of [startIndex, finishIndex]) {
    segments[idx].checker = true;
    segments[idx].sprites.push({ kind: 'banner', offset: 0, seed: idx === startIndex ? 0 : 1 });
  }

  // cenário
  for (let i = 20; i < segments.length; i++) {
    const s = segments[i];
    if (stage.lamps && i % 12 === 0) {
      s.sprites.push({ kind: 'lamp', offset: -1.2, seed: i }, { kind: 'lamp', offset: 1.2, seed: i + 1 });
    }
    if (rand() < stage.density) {
      const side = rand() < 0.5 ? -1 : 1;
      const kind = stage.scenery[Math.floor(rand() * stage.scenery.length)];
      const half = SPRITES[kind].w / 2 / 2000;
      const offset = side * (1.15 + half + rand() * (rand() < 0.15 ? 4 : 1.6));
      s.sprites.push({ kind, offset, seed: Math.floor(rand() * 1e6) });
    }
  }

  return { segments, startZ: startIndex * SEG_LEN, finishZ: finishIndex * SEG_LEN };
}
