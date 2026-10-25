import type { ThemeId } from './themes';

export interface StageDef {
  theme: ThemeId;
  lanes: 2 | 4;
  night?: boolean;
  weather?: 'rain' | 'snow';
  curviness: number;
  hilliness: number;
  sections: number;
  traffic: number;
  police: number;
}

export interface Course {
  id: string;
  name: string;
  level: string;
  rivalSkill: number;
  stages: StageDef[];
}

const s = (theme: ThemeId, lanes: 2 | 4, extra: Partial<StageDef> = {}): StageDef => ({
  theme, lanes, curviness: 1, hilliness: 0.5, sections: 14, traffic: lanes === 4 ? 6 : 4, police: 1, ...extra,
});

export const COURSES: Course[] = [
  {
    id: 'deserto', name: 'Rajada no Deserto', level: 'Fácil', rivalSkill: 0.93,
    stages: [
      s('forest', 2, { curviness: 0.7, police: 0, traffic: 3 }),
      s('forest', 4, { curviness: 0.6, traffic: 4 }),
      s('desert', 2, { hilliness: 0.7, traffic: 3 }),
      s('desert', 4, { curviness: 0.6, traffic: 4 }),
      s('desert', 2, { curviness: 1.1, hilliness: 0.8, traffic: 3 }),
    ],
  },
  {
    id: 'metropole', name: 'Rota da Metrópole', level: 'Médio', rivalSkill: 0.96,
    stages: [
      s('forest', 2, { police: 1 }),
      s('farm', 2, { hilliness: 0.7 }),
      s('forest', 4),
      s('city', 4, { traffic: 7, police: 2 }),
      s('city', 4, { night: true, traffic: 7, police: 2 }),
    ],
  },
  {
    id: 'serra', name: 'Serra e Mar', level: 'Difícil', rivalSkill: 0.99,
    stages: [
      s('snow', 2, { weather: 'snow', curviness: 1.2, hilliness: 0.9 }),
      s('mountain', 2, { curviness: 1.4, hilliness: 1 }),
      s('forest', 2, { night: true, curviness: 1.2 }),
      s('coast', 2, { weather: 'rain', curviness: 1.1 }),
      s('coast', 4, { police: 2 }),
    ],
  },
  {
    id: 'tempestade', name: 'Tempestade', level: 'Expert', rivalSkill: 1.01,
    stages: [
      s('city', 4, { weather: 'rain', traffic: 7, police: 2 }),
      s('snow', 2, { weather: 'snow', curviness: 1.4, hilliness: 1 }),
      s('mountain', 2, { curviness: 1.6, hilliness: 1, weather: 'rain' }),
      s('forest', 2, { night: true, curviness: 1.4, traffic: 5 }),
      s('coast', 2, { night: true, weather: 'rain', curviness: 1.3, police: 2 }),
    ],
  },
];
