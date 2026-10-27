import type { SpriteKind } from './sprites';
import { shade } from './util';

export type BgLayer = 'city' | 'forest' | 'mesa' | 'hills' | 'snowpeaks' | 'dunes' | 'sea'
  | 'redmesa' | 'jungle' | 'autumn' | 'savanna' | 'factory' | 'beach' | 'alps' | 'alpsnow' | 'snowforest';
export type ThemeId = 'forest' | 'farm' | 'desert' | 'city' | 'mountain' | 'snow' | 'coast'
  | 'canyon' | 'jungle' | 'autumn' | 'beach' | 'savanna' | 'industrial' | 'alpine' | 'alpinesnow';

export interface Theme {
  sky: [string, string];
  ground: [string, string]; // duas cores, misturadas em pontilhado
  shoulder: string;
  road: string;
  bg: [BgLayer, BgLayer];
  bgColors: [string, string];
  scenery: SpriteKind[];
  density: number;
  bridges?: number; // viadutos por trecho
  mapColor: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  forest: {
    sky: ['#1e86e8', '#8ed6ff'], ground: ['#0b5c10', '#147216'], shoulder: '#a8a8a8', road: '#474747',
    bg: ['hills', 'forest'], bgColors: ['#3d8a45', '#1e5a28'], scenery: ['tree', 'tree', 'pine', 'bush', 'tree', 'billboard'], density: 0.12, bridges: 1, mapColor: '#2f8a2f',
  },
  farm: {
    sky: ['#2290ec', '#9adcff'], ground: ['#24781a', '#348a24'], shoulder: '#a8a8a8', road: '#474747',
    bg: ['hills', 'forest'], bgColors: ['#5a9a48', '#2a6a30'], scenery: ['house', 'tree', 'fence', 'bush', 'tree', 'barn', 'fence', 'billboard'], density: 0.11, bridges: 1, mapColor: '#58a83a',
  },
  desert: {
    sky: ['#2a7ed8', '#b4dcf4'], ground: ['#c8984e', '#d8aa5e'], shoulder: '#b0a088', road: '#4c4c4c',
    bg: ['mesa', 'dunes'], bgColors: ['#7c8ea2', '#c09858'], scenery: ['cactus', 'cactus', 'rock', 'bush', 'cactus', 'billboard'], density: 0.09, mapColor: '#d0a860',
  },
  city: {
    sky: ['#1e86e8', '#9ed2f0'], ground: ['#0b5c10', '#147216'], shoulder: '#a8a8a8', road: '#474747',
    bg: ['forest', 'city'], bgColors: ['#1e5a28', '#5a5a7a'], scenery: ['lamp', 'tree', 'bush', 'lamp', 'billboard', 'building'], density: 0.15, bridges: 2, mapColor: '#8a8aa8',
  },
  mountain: {
    sky: ['#2272d8', '#a8d4f8'], ground: ['#0a5410', '#126a16'], shoulder: '#a0a0a0', road: '#474747',
    bg: ['mesa', 'forest'], bgColors: ['#6a8296', '#24642e'], scenery: ['pine', 'rock', 'pine', 'tree'], density: 0.13, bridges: 1, mapColor: '#5a7a5a',
  },
  snow: {
    sky: ['#5a86c0', '#c8dcf0'], ground: ['#e2e8f0', '#c6d0dc'], shoulder: '#98a4ae', road: '#4c4c4c',
    bg: ['snowpeaks', 'forest'], bgColors: ['#9eb0c6', '#2a5a3c'], scenery: ['snowpine', 'snowpine', 'rock'], density: 0.14, mapColor: '#e0e8f0',
  },
  coast: {
    sky: ['#1a8ae8', '#a8e2ff'], ground: ['#cdb874', '#bea866'], shoulder: '#b0a898', road: '#474747',
    bg: ['sea', 'hills'], bgColors: ['#2a6ec4', '#3a8a4a'], scenery: ['palm', 'palm', 'bush', 'palm', 'billboard'], density: 0.11, mapColor: '#3a8ad0',
  },
  canyon: {
    sky: ['#2a78d0', '#f0c890'], ground: ['#b85a30', '#c86a3a'], shoulder: '#a08068', road: '#4a4442',
    bg: ['redmesa', 'redmesa'], bgColors: ['#a8482a', '#d47a4a'], scenery: ['spire', 'rock', 'cactus', 'rock', 'spire', 'billboard'], density: 0.1, mapColor: '#c8603a',
  },
  jungle: {
    sky: ['#2a8ad8', '#b8e8d0'], ground: ['#0a4a14', '#10601a'], shoulder: '#8a8a6a', road: '#444444',
    bg: ['jungle', 'jungle'], bgColors: ['#127a2a', '#08401a'], scenery: ['banana', 'palm', 'banana', 'bush', 'tree', 'banana'], density: 0.2, bridges: 1, mapColor: '#1a8a3a',
  },
  autumn: {
    sky: ['#3a82d8', '#f0d8b0'], ground: ['#5a6a1a', '#6a7a24'], shoulder: '#a8a098', road: '#474747',
    bg: ['hills', 'autumn'], bgColors: ['#8a7a3a', '#b8521a'], scenery: ['autumn', 'autumn', 'pine', 'autumn', 'house', 'fence', 'billboard'], density: 0.14, bridges: 1, mapColor: '#d07a2a',
  },
  beach: {
    sky: ['#1a90f0', '#b0ecff'], ground: ['#e8d49a', '#dcc68a'], shoulder: '#c8b890', road: '#4a4a4a',
    bg: ['hills', 'beach'], bgColors: ['#3a8a4a', '#2a6ec4'], scenery: ['umbrella', 'palm', 'umbrella', 'kiosk', 'palm', 'umbrella', 'palm', 'umbrella', 'kiosk', 'palm', 'umbrella', 'palm', 'umbrella', 'lighthouse'], density: 0.13, mapColor: '#f0d070',
  },
  savanna: {
    sky: ['#2a86e0', '#f8e0a0'], ground: ['#b8a24a', '#c8b05a'], shoulder: '#a89a78', road: '#4c4a46',
    bg: ['savanna', 'savanna'], bgColors: ['#9a8a3a', '#c8b05a'], scenery: ['acacia', 'bush', 'acacia', 'rock', 'acacia', 'billboard'], density: 0.08, mapColor: '#c8a840',
  },
  industrial: {
    sky: ['#5a7ab0', '#c8c8c0'], ground: ['#4a5a3a', '#56664a'], shoulder: '#9a9a9a', road: '#404040',
    bg: ['factory', 'city'], bgColors: ['#6a6a72', '#5a5a7a'], scenery: ['factory', 'silo', 'lamp', 'silo', 'billboard', 'factory', 'lamp'], density: 0.13, bridges: 2, mapColor: '#7a7a6a',
  },
  alpine: {
    sky: ['#2a6ad8', '#d0e4f8'], ground: ['#2a7a2a', '#368a30'], shoulder: '#a0a4a8', road: '#474747',
    bg: ['alps', 'forest'], bgColors: ['#9eb0c6', '#2a5a3c'], scenery: ['pine', 'chalet', 'pine', 'rock', 'pine', 'chalet'], density: 0.13, bridges: 1, mapColor: '#6aa0d0',
  },
  // Alpes no inverno: tudo coberto de neve, lago congelado, pinheiros e chalés nevados
  alpinesnow: {
    sky: ['#4a7ac0', '#d8e4f4'], ground: ['#eef2f8', '#d4dce8'], shoulder: '#9aa4b0', road: '#4c4c50',
    bg: ['alpsnow', 'snowforest'], bgColors: ['#c8d4e4', '#3a5a4a'], scenery: ['snowpine', 'snowchalet', 'snowpine', 'snowrock', 'snowpine', 'snowpine', 'snowchalet', 'snowman', 'snowpine'], density: 0.14, bridges: 1, mapColor: '#c8dcf0',
  },
};

// Versão noturna de um tema
export function nightTheme(t: Theme): Theme {
  return {
    ...t,
    sky: ['#04061a', '#1a2050'],
    ground: [shade(t.ground[0], -0.32), shade(t.ground[1], -0.32)],
    shoulder: shade(t.shoulder, -0.4),
    road: shade(t.road, -0.18),
    bgColors: [shade(t.bgColors[0], -0.42), shade(t.bgColors[1], -0.45)],
  };
}

export function rainTheme(t: Theme): Theme {
  return {
    ...t,
    sky: ['#56626e', '#98a4b0'],
    ground: [shade(t.ground[0], -0.12), shade(t.ground[1], -0.12)],
    road: shade(t.road, -0.08),
    bgColors: [shade(t.bgColors[0], -0.15), shade(t.bgColors[1], -0.15)],
  };
}
