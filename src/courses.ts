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
  seed?: number; // semente das pistas (eventos da carreira)
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
  // ---- mapas novos ----
  {
    id: 'litoral', name: 'Litoral Dourado', level: 'Fácil', rivalSkill: 0.93,
    stages: [
      s('beach', 4, { curviness: 0.6, police: 0, traffic: 4 }),
      s('beach', 2, { curviness: 0.8, hilliness: 0.4 }),
      s('coast', 2, { curviness: 0.9 }),
      s('beach', 4, { curviness: 0.7, traffic: 6 }),
      s('coast', 4, { curviness: 0.8, police: 2 }),
    ],
  },
  {
    id: 'savana', name: 'Savana Selvagem', level: 'Fácil', rivalSkill: 0.94,
    stages: [
      s('savanna', 2, { curviness: 0.5, police: 0, traffic: 2 }),
      s('savanna', 2, { curviness: 0.7, hilliness: 0.6, traffic: 3 }),
      s('savanna', 4, { curviness: 0.5, traffic: 4 }),
      s('desert', 2, { curviness: 0.9, traffic: 3 }),
      s('savanna', 2, { curviness: 1, hilliness: 0.8, traffic: 3 }),
    ],
  },
  {
    id: 'outono', name: 'Outono na Serra', level: 'Fácil', rivalSkill: 0.94,
    stages: [
      s('autumn', 2, { curviness: 0.8, police: 0 }),
      s('autumn', 2, { curviness: 1, hilliness: 0.8 }),
      s('farm', 2, { curviness: 0.9 }),
      s('autumn', 4, { curviness: 0.8 }),
      s('mountain', 2, { curviness: 1.2, hilliness: 0.9 }),
    ],
  },
  {
    id: 'canion', name: 'Cânion Vermelho', level: 'Médio', rivalSkill: 0.96,
    stages: [
      s('canyon', 2, { curviness: 1, hilliness: 0.7, traffic: 3 }),
      s('canyon', 2, { curviness: 1.3, hilliness: 0.9, traffic: 3 }),
      s('desert', 4, { curviness: 0.6, police: 2 }),
      s('canyon', 2, { curviness: 1.4, hilliness: 1, traffic: 3 }),
      s('canyon', 4, { curviness: 1, police: 2 }),
    ],
  },
  {
    id: 'selva', name: 'Selva Úmida', level: 'Médio', rivalSkill: 0.96,
    stages: [
      s('jungle', 2, { curviness: 1, traffic: 3 }),
      s('jungle', 2, { curviness: 1.2, hilliness: 0.8, weather: 'rain', traffic: 3 }),
      s('beach', 2, { curviness: 0.9 }),
      s('jungle', 2, { curviness: 1.3, weather: 'rain', traffic: 3 }),
      s('jungle', 4, { curviness: 1.1 }),
    ],
  },
  {
    id: 'industrial', name: 'Polo Industrial', level: 'Médio', rivalSkill: 0.97,
    stages: [
      s('industrial', 4, { curviness: 0.7, traffic: 7 }),
      s('industrial', 4, { curviness: 0.9, traffic: 7, police: 2 }),
      s('farm', 2, { curviness: 1 }),
      s('industrial', 4, { curviness: 0.8, traffic: 8, police: 2 }),
      s('city', 4, { curviness: 0.8, traffic: 8, police: 2 }),
    ],
  },
  {
    id: 'alpes', name: 'Alpes Nevados', level: 'Difícil', rivalSkill: 0.99,
    stages: [
      s('alpine', 2, { curviness: 1.2, hilliness: 0.9 }),
      s('alpine', 2, { curviness: 1.4, hilliness: 1 }),
      s('snow', 2, { weather: 'snow', curviness: 1.3, hilliness: 1 }),
      s('alpine', 2, { curviness: 1.5, hilliness: 1, weather: 'rain' }),
      s('snow', 2, { weather: 'snow', curviness: 1.5, hilliness: 1 }),
    ],
  },
  {
    id: 'grandemetropole', name: 'Grande Metrópole', level: 'Difícil', rivalSkill: 0.99,
    stages: [
      s('city', 4, { traffic: 8, police: 2 }),
      s('industrial', 4, { traffic: 8, police: 2 }),
      s('city', 4, { traffic: 9, police: 3, weather: 'rain' }),
      s('industrial', 4, { traffic: 8, police: 2 }),
      s('city', 4, { traffic: 9, police: 3 }),
    ],
  },
  {
    id: 'penhasco', name: 'Estrada do Penhasco', level: 'Expert', rivalSkill: 1.01,
    stages: [
      s('mountain', 2, { curviness: 1.7, hilliness: 1 }),
      s('coast', 2, { curviness: 1.6, hilliness: 1 }),
      s('canyon', 2, { curviness: 1.7, hilliness: 1 }),
      s('mountain', 2, { curviness: 1.8, hilliness: 1, weather: 'rain' }),
      s('coast', 2, { curviness: 1.7, hilliness: 1 }),
    ],
  },
  {
    id: 'mundo', name: 'Volta ao Mundo', level: 'Expert', rivalSkill: 1.02,
    stages: [
      s('beach', 4, { curviness: 1 }),
      s('jungle', 2, { curviness: 1.4, weather: 'rain' }),
      s('canyon', 2, { curviness: 1.5, hilliness: 1 }),
      s('industrial', 4, { traffic: 8, police: 3 }),
      s('snow', 2, { curviness: 1.6, hilliness: 1, weather: 'snow' }),
    ],
  },
];

// Arcade: o jogador escolhe dia ou noite; o clima de cada trecho continua o do mapa
export const withTimeOfDay = (course: Course, night: boolean): Course => ({
  ...course,
  stages: course.stages.map((st) => ({ ...st, night })),
});
