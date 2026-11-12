import type { ThemeId } from './themes';

export interface StageDef {
  theme: ThemeId;
  lanes: 2 | 4;
  night?: boolean;
  weather?: 'rain' | 'snow' | 'fog';
  dusk?: boolean; // o sol se põe durante o trecho: começa de dia e termina de noite
  tod?: 'sunset' | 'dawn'; // hora dourada fixa: entardecer (sol pela metade no horizonte) ou amanhecer
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

// trecho longo: o dobro das seções de um trecho normal
const L = (theme: ThemeId, lanes: 2 | 4, extra: Partial<StageDef> = {}): StageDef => s(theme, lanes, { sections: 28, ...extra });

const ALL: Course[] = [
  {
    id: 'deserto', name: 'Rajada no Deserto', level: 'Fácil', rivalSkill: 0.93,
    stages: [
      s('forest', 2, { curviness: 0.7, police: 0, traffic: 3 , tod: 'dawn' }),
      s('forest', 4, { curviness: 0.6, traffic: 4 }),
      s('desert', 2, { hilliness: 0.7, traffic: 3 }),
      s('desert', 4, { curviness: 0.6, traffic: 4 }),
      s('desert', 2, { curviness: 1.1, hilliness: 0.8, traffic: 3 , tod: 'sunset' }),
    ],
  },
  {
    id: 'metropole', name: 'Rota da Metrópole', level: 'Médio', rivalSkill: 0.96,
    stages: [
      s('forest', 2, { police: 1 , tod: 'dawn' }),
      s('farm', 2, { hilliness: 0.7 }),
      s('forest', 4),
      s('city', 4, { traffic: 7, police: 2 , tod: 'sunset' }),
      s('city', 4, { night: true, traffic: 7, police: 2 }),
    ],
  },
  {
    id: 'serra', name: 'Serra e Mar', level: 'Difícil', rivalSkill: 0.99,
    stages: [
      s('snow', 2, { weather: 'snow', curviness: 1.2, hilliness: 0.9 }),
      s('mountain', 2, { curviness: 1.4, hilliness: 1 , tod: 'dawn' }),
      s('forest', 2, { weather: 'fog', curviness: 1.2 }),
      s('coast', 2, { weather: 'rain', curviness: 1.1 }),
      s('coast', 4, { police: 2, dusk: true }),
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
      s('beach', 4, { curviness: 0.6, police: 0, traffic: 4 , tod: 'dawn' }),
      s('beach', 2, { curviness: 0.8, hilliness: 0.4 }),
      s('coast', 2, { curviness: 0.9 }),
      s('beach', 4, { curviness: 0.7, traffic: 6 , tod: 'sunset' }),
      s('coast', 4, { curviness: 0.8, police: 2, dusk: true }),
    ],
  },
  {
    id: 'savana', name: 'Savana Selvagem', level: 'Fácil', rivalSkill: 0.94,
    stages: [
      s('savanna', 2, { curviness: 0.5, police: 0, traffic: 2 , tod: 'dawn' }),
      s('savanna', 2, { curviness: 0.7, hilliness: 0.6, traffic: 3 }),
      s('savanna', 4, { curviness: 0.5, traffic: 4 , tod: 'sunset' }),
      s('desert', 2, { curviness: 0.9, traffic: 3 }),
      s('savanna', 2, { curviness: 1, hilliness: 0.8, traffic: 3, dusk: true }),
    ],
  },
  {
    id: 'outono', name: 'Outono na Serra', level: 'Fácil', rivalSkill: 0.94,
    stages: [
      s('autumn', 2, { curviness: 0.8, police: 0 , tod: 'dawn' }),
      s('autumn', 2, { curviness: 1, hilliness: 0.8 }),
      s('farm', 2, { curviness: 0.9 }),
      s('autumn', 4, { curviness: 0.8 , tod: 'sunset' }),
      s('mountain', 2, { curviness: 1.2, hilliness: 0.9, weather: 'fog' }),
    ],
  },
  {
    id: 'canion', name: 'Cânion Vermelho', level: 'Médio', rivalSkill: 0.96,
    stages: [
      s('canyon', 2, { curviness: 1, hilliness: 0.7, traffic: 3 , tod: 'dawn' }),
      s('canyon', 2, { curviness: 1.3, hilliness: 0.9, traffic: 3 , tod: 'sunset' }),
      s('desert', 4, { curviness: 0.6, police: 2 }),
      s('canyon', 2, { curviness: 1.4, hilliness: 1, traffic: 3 }),
      s('canyon', 4, { curviness: 1, police: 2, dusk: true }),
    ],
  },
  {
    id: 'selva', name: 'Selva Úmida', level: 'Médio', rivalSkill: 0.96,
    stages: [
      s('jungle', 2, { curviness: 1, traffic: 3 }),
      s('jungle', 2, { curviness: 1.2, hilliness: 0.8, weather: 'rain', traffic: 3 }),
      s('beach', 2, { curviness: 0.9 }),
      s('jungle', 2, { curviness: 1.3, weather: 'rain', traffic: 3 }),
      s('jungle', 4, { curviness: 1.1 , tod: 'sunset' }),
    ],
  },
  {
    id: 'industrial', name: 'Polo Industrial', level: 'Médio', rivalSkill: 0.97,
    stages: [
      s('industrial', 4, { curviness: 0.7, traffic: 7 , tod: 'dawn' }),
      s('industrial', 4, { curviness: 0.9, traffic: 7, police: 2 }),
      s('farm', 2, { curviness: 1 }),
      s('industrial', 4, { curviness: 0.8, traffic: 8, police: 2 }),
      s('city', 4, { curviness: 0.8, traffic: 8, police: 2 }),
    ],
  },
  {
    id: 'alpes', name: 'Alpes Nevados', level: 'Difícil', rivalSkill: 0.99,
    stages: [
      s('alpine', 2, { curviness: 1.2, hilliness: 0.9 , tod: 'dawn' }),
      s('alpine', 2, { curviness: 1.4, hilliness: 1, weather: 'fog' }),
      s('alpinesnow', 2, { weather: 'snow', curviness: 1.3, hilliness: 1 }),
      s('alpine', 2, { curviness: 1.5, hilliness: 1, weather: 'rain' }),
      s('alpinesnow', 2, { weather: 'snow', curviness: 1.5, hilliness: 1 }),
    ],
  },
  {
    id: 'grandemetropole', name: 'Grande Metrópole', level: 'Difícil', rivalSkill: 0.99,
    stages: [
      s('city', 4, { traffic: 8, police: 2 }),
      s('industrial', 4, { traffic: 8, police: 2 }),
      s('city', 4, { traffic: 9, police: 3, weather: 'rain' }),
      s('industrial', 4, { traffic: 8, police: 2 }),
      s('city', 4, { traffic: 9, police: 3 , tod: 'sunset' }),
    ],
  },
  {
    id: 'penhasco', name: 'Estrada do Penhasco', level: 'Expert', rivalSkill: 1.01,
    stages: [
      s('mountain', 2, { curviness: 1.7, hilliness: 1 , tod: 'dawn' }),
      s('coast', 2, { curviness: 1.6, hilliness: 1, weather: 'fog' }),
      s('canyon', 2, { curviness: 1.7, hilliness: 1 }),
      s('mountain', 2, { curviness: 1.8, hilliness: 1, weather: 'rain' }),
      s('coast', 2, { curviness: 1.7, hilliness: 1, dusk: true }),
    ],
  },
  {
    id: 'mundo', name: 'Volta ao Mundo', level: 'Expert', rivalSkill: 1.02,
    stages: [
      s('beach', 4, { curviness: 1 , tod: 'sunset' }),
      s('jungle', 2, { curviness: 1.4, weather: 'rain' }),
      s('canyon', 2, { curviness: 1.5, hilliness: 1 , tod: 'dawn' }),
      s('industrial', 4, { traffic: 8, police: 3 }),
      s('alpinesnow', 2, { curviness: 1.6, hilliness: 1, weather: 'snow' }),
    ],
  },
  // ---- mapas novos: túneis, neblina e pôr do sol ----
  {
    id: 'crepusculo', name: 'Crepúsculo na Costa', level: 'Médio', rivalSkill: 0.96, seed: 41000,
    stages: [
      s('beach', 4, { curviness: 0.8 }),
      s('coast', 2, { curviness: 1, hilliness: 0.6 , tod: 'sunset' }),
      s('coast', 2, { curviness: 1.1, dusk: true }),
      s('beach', 2, { curviness: 0.9, night: true, traffic: 5 }),
      s('coast', 4, { curviness: 1, night: true, police: 2 }),
    ],
  },
  {
    id: 'neblina', name: 'Vale da Neblina', level: 'Médio', rivalSkill: 0.97, seed: 42000,
    stages: [
      s('forest', 2, { curviness: 1, weather: 'fog' }),
      s('farm', 2, { curviness: 0.9, hilliness: 0.7, weather: 'fog' }),
      s('mountain', 2, { curviness: 1.2, hilliness: 0.9 , tod: 'dawn' }),
      s('forest', 2, { curviness: 1.2, weather: 'fog', night: true }),
      s('mountain', 2, { curviness: 1.3, hilliness: 1, weather: 'fog' }),
    ],
  },
  {
    id: 'tuneis', name: 'Rota dos Túneis', level: 'Difícil', rivalSkill: 0.99, seed: 43000,
    stages: [
      s('mountain', 2, { curviness: 1.3, hilliness: 1 , tod: 'dawn' }),
      s('canyon', 2, { curviness: 1.4, hilliness: 1 }),
      s('alpine', 2, { curviness: 1.5, hilliness: 1, dusk: true }),
      s('mountain', 2, { curviness: 1.6, hilliness: 1, night: true }),
      s('coast', 2, { curviness: 1.5, hilliness: 1, weather: 'rain', night: true }),
    ],
  },
  {
    id: 'noturno', name: 'Expresso Noturno', level: 'Difícil', rivalSkill: 1.0, seed: 44000,
    stages: [
      s('industrial', 4, { night: true, traffic: 8, police: 2 }),
      s('city', 4, { night: true, traffic: 9, police: 3 }),
      s('industrial', 4, { night: true, weather: 'rain', traffic: 8, police: 2 }),
      s('city', 4, { night: true, weather: 'rain', traffic: 9, police: 3 }),
      s('city', 4, { night: true, weather: 'fog', traffic: 8, police: 3 }),
    ],
  },
  {
    id: 'inverno', name: 'Inverno Extremo', level: 'Expert', rivalSkill: 1.02, seed: 45000,
    stages: [
      s('alpinesnow', 2, { weather: 'snow', curviness: 1.5, hilliness: 1 }),
      s('alpine', 2, { weather: 'fog', curviness: 1.6, hilliness: 1 }),
      s('alpinesnow', 2, { weather: 'snow', curviness: 1.7, hilliness: 1, night: true }),
      s('snow', 2, { weather: 'snow', curviness: 1.6, hilliness: 1 }),
      s('alpinesnow', 2, { weather: 'snow', curviness: 1.8, hilliness: 1, dusk: true }),
    ],
  },
  {
    id: 'lendas', name: 'Rota das Lendas', level: 'Lenda', rivalSkill: 1.03, seed: 46000,
    stages: [
      s('desert', 4, { curviness: 1, police: 3 , tod: 'dawn' }),
      s('canyon', 2, { curviness: 1.7, hilliness: 1, dusk: true }),
      s('mountain', 2, { curviness: 1.8, hilliness: 1, weather: 'fog' }),
      s('alpinesnow', 2, { curviness: 1.8, hilliness: 1, weather: 'snow' }),
      s('coast', 2, { curviness: 1.8, hilliness: 1, weather: 'rain', night: true }),
      s('city', 4, { night: true, traffic: 10, police: 3 }),
    ],
  },
  // ---- roteiros longos (trechos com o dobro do tamanho: 28 seções) ----
  {
    id: 'litoralnorte', name: 'Litoral Norte', level: 'Fácil', rivalSkill: 0.93,
    stages: [
      L('beach', 4, { curviness: 0.6, police: 0, traffic: 4, tod: 'dawn' }),
      L('coast', 2, { curviness: 0.8, traffic: 3 }),
      L('beach', 2, { curviness: 0.9, hilliness: 0.6 }),
      L('jungle', 2, { curviness: 0.9 }),
      L('coast', 4, { curviness: 0.7, tod: 'sunset' }),
    ],
  },
  {
    id: 'cerrado', name: 'Cerrado Sem Fim', level: 'Fácil', rivalSkill: 0.94,
    stages: [
      L('savanna', 4, { curviness: 0.5, police: 0, traffic: 4, tod: 'dawn' }),
      L('farm', 2, { hilliness: 0.7 }),
      L('savanna', 2, { curviness: 0.8, hilliness: 0.6 }),
      L('desert', 4, { curviness: 0.6, police: 2 }),
      L('savanna', 2, { curviness: 0.9, dusk: true }),
    ],
  },
  {
    id: 'transamazonica', name: 'Transamazônica', level: 'Médio', rivalSkill: 0.96,
    stages: [
      L('jungle', 2, { curviness: 1, tod: 'dawn' }),
      L('jungle', 2, { curviness: 1.2, weather: 'rain' }),
      L('savanna', 2, { curviness: 0.8, hilliness: 0.7 }),
      L('jungle', 2, { curviness: 1.1, weather: 'fog' }),
      L('jungle', 2, { night: true, curviness: 1.1, weather: 'rain' }),
    ],
  },
  {
    id: 'rotadoouro', name: 'Rota do Ouro', level: 'Médio', rivalSkill: 0.96,
    stages: [
      L('desert', 4, { curviness: 0.7, police: 2, tod: 'dawn' }),
      L('canyon', 2, { curviness: 1.2, hilliness: 0.9 }),
      L('desert', 2, { curviness: 1, hilliness: 0.8 }),
      L('canyon', 2, { curviness: 1.3, hilliness: 1, tod: 'sunset' }),
      L('mountain', 2, { curviness: 1.3, night: true }),
    ],
  },
  {
    id: 'polo', name: 'Polo Industrial', level: 'Médio', rivalSkill: 0.965,
    stages: [
      L('farm', 4, { curviness: 0.7, tod: 'dawn' }),
      L('industrial', 4, { traffic: 7, police: 2 }),
      L('industrial', 4, { weather: 'fog', traffic: 7 }),
      L('city', 4, { weather: 'rain', traffic: 8, police: 2 }),
      L('industrial', 4, { night: true, traffic: 8, police: 2 }),
    ],
  },
  {
    id: 'serragaucha', name: 'Serra Gaúcha', level: 'Difícil', rivalSkill: 0.98,
    stages: [
      L('autumn', 2, { curviness: 1.2, hilliness: 0.9, tod: 'dawn' }),
      L('farm', 2, { curviness: 1.1, hilliness: 1, weather: 'fog' }),
      L('autumn', 2, { curviness: 1.4, hilliness: 1, weather: 'rain' }),
      L('mountain', 2, { curviness: 1.5, hilliness: 1 }),
      L('autumn', 2, { curviness: 1.3, night: true, weather: 'fog' }),
    ],
  },
  {
    id: 'costaverde', name: 'Costa Verde', level: 'Difícil', rivalSkill: 0.98,
    stages: [
      L('coast', 2, { curviness: 1.3, hilliness: 0.8, tod: 'dawn' }),
      L('jungle', 2, { curviness: 1.4, weather: 'rain' }),
      L('beach', 2, { curviness: 1.2, police: 2 }),
      L('coast', 2, { curviness: 1.5, hilliness: 1, weather: 'fog' }),
      L('coast', 2, { curviness: 1.4, night: true, weather: 'rain' }),
    ],
  },
  {
    id: 'marginal', name: 'Marginal à Noite', level: 'Difícil', rivalSkill: 0.985,
    stages: [
      L('city', 4, { dusk: true, traffic: 8, police: 2 }),
      L('city', 4, { night: true, traffic: 9, police: 2 }),
      L('industrial', 4, { night: true, traffic: 8, weather: 'rain' }),
      L('city', 4, { night: true, traffic: 10, police: 3, weather: 'fog' }),
      L('city', 4, { night: true, traffic: 9, police: 3, weather: 'rain' }),
    ],
  },
  {
    id: 'cordilheira', name: 'Cordilheira', level: 'Expert', rivalSkill: 1.0,
    stages: [
      L('alpine', 2, { curviness: 1.5, hilliness: 1, tod: 'dawn' }),
      L('alpinesnow', 2, { curviness: 1.6, hilliness: 1, weather: 'snow' }),
      L('mountain', 2, { curviness: 1.7, hilliness: 1, weather: 'fog' }),
      L('snow', 2, { curviness: 1.6, hilliness: 1, weather: 'snow', tod: 'sunset' }),
      L('alpine', 2, { curviness: 1.7, hilliness: 1, night: true, weather: 'rain' }),
    ],
  },
  {
    id: 'maratona', name: 'Grande Maratona', level: 'Expert', rivalSkill: 1.01,
    stages: [
      L('beach', 4, { curviness: 0.9, tod: 'dawn' }),
      L('canyon', 2, { curviness: 1.6, hilliness: 1 }),
      L('city', 4, { traffic: 9, police: 3, weather: 'rain' }),
      L('alpinesnow', 2, { curviness: 1.7, hilliness: 1, weather: 'snow', dusk: true }),
      L('mountain', 2, { curviness: 1.8, hilliness: 1, night: true, weather: 'fog' }),
    ],
  },
];

// ordem do Arcade, do mais fácil ao mais difícil: cada mapa concluído libera o seguinte
const ORDER = ['deserto', 'litoral', 'savana', 'outono', 'metropole', 'canion', 'selva', 'crepusculo', 'industrial', 'neblina',
  'serra', 'alpes', 'tuneis', 'grandemetropole', 'noturno', 'tempestade', 'penhasco', 'inverno', 'mundo', 'lendas',
  'litoralnorte', 'cerrado', 'transamazonica', 'rotadoouro', 'polo', 'serragaucha', 'costaverde', 'marginal', 'cordilheira', 'maratona'];
export const COURSES: Course[] = ORDER.map((id) => ALL.find((c) => c.id === id)!);

// mapas liberados no Arcade (no começo só o primeiro), guardado no aparelho
const UNLOCK_KEY = 'duel-racer:mapas';
// FASE DE TESTES: todos os mapas do Arcade liberados para conferir à mão antes do lançamento.
// Para voltar ao desbloqueio em sequência, troque para false.
const TEST_UNLOCK_ALL = true;
export function unlockedCourses(): number {
  if (TEST_UNLOCK_ALL) return COURSES.length;
  try {
    const v = Number(localStorage.getItem(UNLOCK_KEY) ?? 1);
    return Math.max(1, Math.min(COURSES.length, Number.isFinite(v) ? v : 1));
  } catch {
    return 1;
  }
}
// concluiu o mapa i: libera o seguinte (devolve true se liberou um novo)
export function completeCourse(i: number): boolean {
  const n = unlockedCourses();
  if (i + 2 <= n || i + 1 >= COURSES.length) return false;
  try {
    localStorage.setItem(UNLOCK_KEY, String(i + 2));
  } catch { /* sem armazenamento */ }
  return true;
}

// Arcade: o jogador escolhe a hora (DIA segue o mapa, com os entardeceres e amanheceres dele;
// ENTARDECER, AMANHECER e NOITE valem para o roteiro inteiro); o clima continua o do mapa
export type ArcadeTime = 'day' | 'sunset' | 'dawn' | 'night';
export const TIME_LABEL: Record<ArcadeTime, string> = { day: 'DIA', sunset: 'ENTARDECER', dawn: 'AMANHECER', night: 'NOITE' };
export const TIME_NEXT: Record<ArcadeTime, ArcadeTime> = { day: 'sunset', sunset: 'dawn', dawn: 'night', night: 'day' };
export const withTimeOfDay = (course: Course, t: ArcadeTime | boolean): Course => {
  const time: ArcadeTime = t === true ? 'night' : t === false ? 'day' : t;
  return {
    ...course,
    stages: course.stages.map((st) => (time === 'day' ? { ...st } : time === 'night' ? { ...st, night: true, dusk: false, tod: undefined } : { ...st, night: false, dusk: false, tod: time })),
  };
};
