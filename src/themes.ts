import type { SpriteKind } from './sprites';
import { shade } from './util';

export type BgLayer = 'city' | 'forest' | 'mesa' | 'hills' | 'snowpeaks' | 'dunes' | 'sea';
export type ThemeId = 'forest' | 'farm' | 'desert' | 'city' | 'mountain' | 'snow' | 'coast';

export interface Theme {
  sky: [string, string];
  ground: [string, string]; // duas cores, misturadas em pontilhado
  shoulder: string;
  road: string;
  bg: [BgLayer, BgLayer];
  bgColors: [string, string];
  scenery: SpriteKind[];
  density: number;
  mapColor: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  forest: {
    sky: ['#2f9cff', '#a6d8ff'], ground: ['#2d8a2d', '#3b9a36'], shoulder: '#a9a9a9', road: '#4b4b4b',
    bg: ['hills', 'forest'], bgColors: ['#3d8a45', '#1e5a28'], scenery: ['tree', 'tree', 'pine', 'bush'], density: 0.22, mapColor: '#2f8a2f',
  },
  farm: {
    sky: ['#3aa4ff', '#b4e0ff'], ground: ['#4a9a32', '#58a83a'], shoulder: '#b0b0b0', road: '#4e4e4e',
    bg: ['hills', 'forest'], bgColors: ['#5a9a48', '#2a6a30'], scenery: ['house', 'tree', 'fence', 'bush', 'tree'], density: 0.2, mapColor: '#58a83a',
  },
  desert: {
    sky: ['#3a9cf0', '#d2ecff'], ground: ['#d8b066', '#ccA25a'], shoulder: '#b8a888', road: '#545454',
    bg: ['mesa', 'dunes'], bgColors: ['#7c8ea2', '#c09858'], scenery: ['cactus', 'cactus', 'rock', 'bush'], density: 0.16, mapColor: '#d0a860',
  },
  city: {
    sky: ['#3a9cff', '#b0dcff'], ground: ['#2d8a2d', '#3b9a36'], shoulder: '#b4b4b4', road: '#474747',
    bg: ['city', 'forest'], bgColors: ['#5a5a7a', '#1e5a28'], scenery: ['building', 'lamp', 'tree', 'building'], density: 0.28, mapColor: '#8a8aa8',
  },
  mountain: {
    sky: ['#3a8ae0', '#b8dcff'], ground: ['#3a8a3a', '#459440'], shoulder: '#a0a0a0', road: '#4a4a4a',
    bg: ['mesa', 'forest'], bgColors: ['#6a8296', '#24642e'], scenery: ['pine', 'rock', 'pine', 'tree'], density: 0.24, mapColor: '#5a7a5a',
  },
  snow: {
    sky: ['#6a8fbf', '#dde8f4'], ground: ['#eaf0f6', '#d6dee8'], shoulder: '#98a4ae', road: '#505050',
    bg: ['snowpeaks', 'forest'], bgColors: ['#9eb0c6', '#2a5a3c'], scenery: ['snowpine', 'snowpine', 'rock'], density: 0.26, mapColor: '#e0e8f0',
  },
  coast: {
    sky: ['#38a0ff', '#bce6ff'], ground: ['#dccb8a', '#d0bf7c'], shoulder: '#b8b0a0', road: '#4f4f4f',
    bg: ['sea', 'hills'], bgColors: ['#2a6ec4', '#3a8a4a'], scenery: ['palm', 'palm', 'bush'], density: 0.2, mapColor: '#3a8ad0',
  },
};

// Versão noturna de um tema
export function nightTheme(t: Theme): Theme {
  return {
    ...t,
    sky: ['#03061a', '#18204a'],
    ground: [shade(t.ground[0], -0.32), shade(t.ground[1], -0.32)],
    shoulder: shade(t.shoulder, -0.4),
    road: shade(t.road, -0.18),
    bgColors: [shade(t.bgColors[0], -0.42), shade(t.bgColors[1], -0.45)],
  };
}

export function rainTheme(t: Theme): Theme {
  return {
    ...t,
    sky: ['#5a6878', '#9aa6b2'],
    ground: [shade(t.ground[0], -0.12), shade(t.ground[1], -0.12)],
    road: shade(t.road, -0.08),
    bgColors: [shade(t.bgColors[0], -0.15), shade(t.bgColors[1], -0.15)],
  };
}
