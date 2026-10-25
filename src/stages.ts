import type { SpriteKind } from './sprites';

export interface Palette {
  skyTop: string;
  skyBottom: string;
  sun?: string;
  far: string;
  near: string;
  grassLight: string;
  grassDark: string;
  roadLight: string;
  roadDark: string;
  rumbleLight: string;
  rumbleDark: string;
  lane: string;
}

export interface Stage {
  id: string;
  name: string;
  seed: number;
  sections: number;
  curviness: number;
  hilliness: number;
  density: number;
  scenery: SpriteKind[];
  background: 'mountains' | 'city';
  lamps?: boolean;
  traffic: number;
  palette: Palette;
}

export const STAGES: Stage[] = [
  {
    id: 'costa',
    name: 'Costa do Sol',
    seed: 1,
    sections: 26,
    curviness: 1,
    hilliness: 0.4,
    density: 0.35,
    scenery: ['palm', 'palm', 'bush', 'rock'],
    background: 'mountains',
    traffic: 12,
    palette: {
      skyTop: '#2f6fd0', skyBottom: '#a9dcff', sun: '#fff6c0',
      far: '#8fb3d9', near: '#4f8a52',
      grassLight: '#46a84f', grassDark: '#3d9746',
      roadLight: '#6e6e6e', roadDark: '#686868',
      rumbleLight: '#ffffff', rumbleDark: '#cc2222', lane: '#ffffff',
    },
  },
  {
    id: 'deserto',
    name: 'Deserto Vermelho',
    seed: 7,
    sections: 30,
    curviness: 0.8,
    hilliness: 0.7,
    density: 0.22,
    scenery: ['cactus', 'cactus', 'rock', 'bush'],
    background: 'mountains',
    traffic: 10,
    palette: {
      skyTop: '#d9622b', skyBottom: '#ffd08a', sun: '#fffbe0',
      far: '#c9804f', near: '#9c4f2a',
      grassLight: '#e3b26b', grassDark: '#d6a45d',
      roadLight: '#7a6a5a', roadDark: '#736352',
      rumbleLight: '#ffffff', rumbleDark: '#aa3333', lane: '#ffe9a8',
    },
  },
  {
    id: 'serra',
    name: 'Serra Nevada',
    seed: 13,
    sections: 32,
    curviness: 1.25,
    hilliness: 1,
    density: 0.45,
    scenery: ['pine', 'pine', 'pine', 'rock'],
    background: 'mountains',
    traffic: 12,
    palette: {
      skyTop: '#5f80aa', skyBottom: '#dde7f2',
      far: '#b9c6d8', near: '#7a8ca3',
      grassLight: '#eef3f7', grassDark: '#dde5ec',
      roadLight: '#565656', roadDark: '#505050',
      rumbleLight: '#ffffff', rumbleDark: '#2255aa', lane: '#ffffff',
    },
  },
  {
    id: 'neon',
    name: 'Neon Noturno',
    seed: 21,
    sections: 30,
    curviness: 1,
    hilliness: 0.5,
    density: 0.3,
    scenery: ['building', 'building', 'building'],
    background: 'city',
    lamps: true,
    traffic: 14,
    palette: {
      skyTop: '#0b0425', skyBottom: '#43126b', sun: '#ffd6ff',
      far: '#1d0f3a', near: '#120a26',
      grassLight: '#1d1d2c', grassDark: '#181826',
      roadLight: '#30303c', roadDark: '#2b2b36',
      rumbleLight: '#ff2bd6', rumbleDark: '#1b1b28', lane: '#00f0ff',
    },
  },
];
