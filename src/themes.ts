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
    sky: ['#38b2f6', '#38b2f6'], ground: ['#0b5c10', '#147216'], shoulder: '#a8a8a8', road: '#474747',
    bg: ['hills', 'forest'], bgColors: ['#3d8a45', '#1e5a28'], scenery: ['tree', 'tree', 'pine', 'bush'], density: 0.12, mapColor: '#2f8a2f',
  },
  farm: {
    sky: ['#3cb4f8', '#3cb4f8'], ground: ['#24781a', '#348a24'], shoulder: '#a8a8a8', road: '#474747',
    bg: ['hills', 'forest'], bgColors: ['#5a9a48', '#2a6a30'], scenery: ['house', 'tree', 'fence', 'bush', 'tree'], density: 0.11, mapColor: '#58a83a',
  },
  desert: {
    sky: ['#4aa8f0', '#4aa8f0'], ground: ['#c8984e', '#d8aa5e'], shoulder: '#b0a088', road: '#4c4c4c',
    bg: ['mesa', 'dunes'], bgColors: ['#7c8ea2', '#c09858'], scenery: ['cactus', 'cactus', 'rock', 'bush'], density: 0.09, mapColor: '#d0a860',
  },
  city: {
    sky: ['#38b2f6', '#38b2f6'], ground: ['#0b5c10', '#147216'], shoulder: '#a8a8a8', road: '#474747',
    bg: ['city', 'forest'], bgColors: ['#5a5a7a', '#1e5a28'], scenery: ['lamp', 'tree', 'bush'], density: 0.15, mapColor: '#8a8aa8',
  },
  mountain: {
    sky: ['#4a9ef0', '#4a9ef0'], ground: ['#0a5410', '#126a16'], shoulder: '#a0a0a0', road: '#474747',
    bg: ['mesa', 'forest'], bgColors: ['#6a8296', '#24642e'], scenery: ['pine', 'rock', 'pine', 'tree'], density: 0.13, mapColor: '#5a7a5a',
  },
  snow: {
    sky: ['#7aa4d4', '#7aa4d4'], ground: ['#e2e8f0', '#c6d0dc'], shoulder: '#98a4ae', road: '#4c4c4c',
    bg: ['snowpeaks', 'forest'], bgColors: ['#9eb0c6', '#2a5a3c'], scenery: ['snowpine', 'snowpine', 'rock'], density: 0.14, mapColor: '#e0e8f0',
  },
  coast: {
    sky: ['#3cb4f8', '#3cb4f8'], ground: ['#cdb874', '#bea866'], shoulder: '#b0a898', road: '#474747',
    bg: ['sea', 'hills'], bgColors: ['#2a6ec4', '#3a8a4a'], scenery: ['palm', 'palm', 'bush'], density: 0.11, mapColor: '#3a8ad0',
  },
};

// Versão noturna de um tema
export function nightTheme(t: Theme): Theme {
  return {
    ...t,
    sky: ['#0a0e2a', '#0a0e2a'],
    ground: [shade(t.ground[0], -0.32), shade(t.ground[1], -0.32)],
    shoulder: shade(t.shoulder, -0.4),
    road: shade(t.road, -0.18),
    bgColors: [shade(t.bgColors[0], -0.42), shade(t.bgColors[1], -0.45)],
  };
}

export function rainTheme(t: Theme): Theme {
  return {
    ...t,
    sky: ['#6e7c8c', '#6e7c8c'],
    ground: [shade(t.ground[0], -0.12), shade(t.ground[1], -0.12)],
    road: shade(t.road, -0.08),
    bgColors: [shade(t.bgColors[0], -0.15), shade(t.bgColors[1], -0.15)],
  };
}
