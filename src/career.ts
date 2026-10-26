// Modo Carreira: regiões com eventos contra pilotos com nome, dinheiro, concessionária,
// garagem (pintura e melhorias) e progresso salvo no aparelho.
import { CARS, type CarSpec } from './cars';
import type { Course, StageDef } from './courses';
import type { RivalStyle } from './race';
import type { ThemeId } from './themes';

export interface Driver { name: string; car: string; style: RivalStyle; skill: number; paint: string; quote: string }
export interface CareerEvent { id: string; name: string; driver: Driver; stages: StageDef[]; prize: number; boss?: boolean }
export interface Region { id: string; name: string; desc: string; color: string; events: CareerEvent[] }

const st = (theme: ThemeId, lanes: 2 | 4, extra: Partial<StageDef> = {}): StageDef => ({
  theme, lanes, curviness: 1, hilliness: 0.5, sections: 10, traffic: lanes === 4 ? 6 : 4, police: 1, ...extra,
});
const drv = (name: string, car: string, style: RivalStyle, skill: number, paint: string, quote: string): Driver =>
  ({ name, car, style, skill, paint, quote });

export const REGIONS: Region[] = [
  {
    id: 'costa', name: 'Costa do Sol', desc: 'Estradas à beira-mar, trânsito leve.', color: '#3a8ad0',
    events: [
      { id: 'c1', name: 'Racha da Orla', prize: 9000, driver: drv('Dudu Pneu', 'serpe-v10', 'cauteloso', 0.88, '#1a9a3a', 'Vai com calma, novato.'), stages: [st('coast', 2, { curviness: 0.6, police: 0, traffic: 3, sections: 8 })] },
      { id: 'c2', name: 'Farol Vermelho', prize: 12000, driver: drv('Lia Faísca', 'vortex-zr', 'imprevisivel', 0.9, '#ececec', 'Hoje eu tô inspirada!'), stages: [st('coast', 2, { curviness: 0.8, traffic: 3 })] },
      { id: 'c3', name: 'Coqueiral', prize: 15000, driver: drv('Beto Turbo', 'kaze-nx', 'agressivo', 0.91, '#d01818', 'Sai da minha frente!'), stages: [st('coast', 4, { curviness: 0.7 }), st('forest', 2, { curviness: 0.7, police: 0 })] },
      { id: 'c4', name: 'Pôr do Sol', prize: 18000, driver: drv('Nina Maresia', 'vortex-zr', 'cauteloso', 0.93, '#18b8d0', 'Constância vence corrida.'), stages: [st('coast', 2, { curviness: 1 }), st('coast', 2, { night: true, curviness: 0.9 })] },
      { id: 'c5', name: 'Rei da Praia', prize: 35000, boss: true, driver: drv('Capitão Maré', 'kaze-nx', 'agressivo', 0.95, '#1f4fd0', 'Esta costa é minha há dez anos.'), stages: [st('coast', 4, { curviness: 0.9 }), st('coast', 2, { curviness: 1.1, weather: 'rain' }), st('forest', 2, { curviness: 1 })] },
    ],
  },
  {
    id: 'vale', name: 'Vale Verde', desc: 'Fazendas, colinas e pontes.', color: '#58a83a',
    events: [
      { id: 'v1', name: 'Estrada do Celeiro', prize: 16000, driver: drv('Zé Trator', 'serpe-v10', 'agressivo', 0.93, '#d8c49a', 'Aqui é terra de gente bruta.'), stages: [st('farm', 2, { hilliness: 0.8 })] },
      { id: 'v2', name: 'Colheita Rápida', prize: 20000, driver: drv('Rosa Vento', 'kaze-nx', 'cauteloso', 0.94, '#7a3ac8', 'Respeite as curvas.'), stages: [st('farm', 2, { hilliness: 0.9, curviness: 1.1 }), st('forest', 2)] },
      { id: 'v3', name: 'Ponte Velha', prize: 24000, driver: drv('Tico Nitro', 'vortex-zr', 'imprevisivel', 0.95, '#f0c000', 'Nem eu sei o que vou fazer.'), stages: [st('forest', 4), st('farm', 2, { night: true })] },
      { id: 'v4', name: 'Serra Baixa', prize: 28000, driver: drv('Marta Freio', 'toro-lp5', 'cauteloso', 0.94, '#8a8c92', 'Frear também é pilotar.'), stages: [st('forest', 2, { curviness: 1.2, hilliness: 0.9 }), st('farm', 4)] },
      { id: 'v5', name: 'Barão do Vale', prize: 60000, boss: true, driver: drv('Barão do Vale', 'furia-tr', 'agressivo', 0.96, '#1c1c20', 'Minha fazenda, minhas regras.'), stages: [st('farm', 2, { hilliness: 1 }), st('forest', 2, { night: true, curviness: 1.1 }), st('farm', 4, { weather: 'rain' })] },
    ],
  },
  {
    id: 'deserto', name: 'Rota do Deserto', desc: 'Retas longas, calor e polícia.', color: '#d0a860',
    events: [
      { id: 'd1', name: 'Miragem', prize: 26000, driver: drv('Sol Escaldante', 'toro-lp5', 'agressivo', 0.94, '#f0c000', 'O asfalto derrete, eu não.'), stages: [st('desert', 4, { police: 2 })] },
      { id: 'd2', name: 'Cânion', prize: 32000, driver: drv('Kiko Poeira', 'furia-tr', 'imprevisivel', 0.94, '#d8c49a', 'Cuidado com a poeira!'), stages: [st('desert', 2, { curviness: 1.2, hilliness: 0.8 }), st('desert', 2, { police: 2 })] },
      { id: 'd3', name: 'Oásis Noturno', prize: 38000, driver: drv('Vera Lua', 'furia-tr', 'cauteloso', 0.95, '#7a3ac8', 'A noite é minha aliada.'), stages: [st('desert', 4, { night: true }), st('desert', 2, { night: true, curviness: 1.1 })] },
      { id: 'd4', name: 'Tempestade de Areia', prize: 45000, driver: drv('Gil Cascavel', 'toro-v12', 'agressivo', 0.95, '#1a9a3a', 'Morde e não solta.'), stages: [st('desert', 2, { curviness: 1.3 }), st('desert', 4, { police: 2 })] },
      { id: 'd5', name: 'O Escorpião', prize: 90000, boss: true, driver: drv('Escorpião', 'toro-v12', 'agressivo', 0.96, '#1c1c20', 'Ninguém atravessa o deserto na minha frente.'), stages: [st('desert', 4, { police: 2 }), st('desert', 2, { curviness: 1.3, hilliness: 0.9 }), st('desert', 2, { night: true, curviness: 1.2 })] },
    ],
  },
  {
    id: 'metropole', name: 'Metrópole', desc: 'Avenidas cheias, viadutos e noite.', color: '#8a8aa8',
    events: [
      { id: 'm1', name: 'Hora do Rush', prize: 42000, driver: drv('Táxi Veloz', 'furia-tr', 'imprevisivel', 0.95, '#f0c000', 'Corrida até o aeroporto?'), stages: [st('city', 4, { traffic: 8, police: 2 })] },
      { id: 'm2', name: 'Avenida Neon', prize: 50000, driver: drv('Dani Neon', 'silber-95', 'cauteloso', 0.96, '#18b8d0', 'Luzes, câmera, aceleração.'), stages: [st('city', 4, { night: true, traffic: 7 }), st('city', 4, { night: true, police: 2 })] },
      { id: 'm3', name: 'Túnel do Centro', prize: 58000, driver: drv('Rato de Garagem', 'toro-v12', 'agressivo', 0.96, '#8a8c92', 'Conheço cada atalho.'), stages: [st('city', 4, { traffic: 8 }), st('forest', 4, { night: true })] },
      { id: 'm4', name: 'Chuva no Asfalto', prize: 66000, driver: drv('Iara Tormenta', 'silber-95', 'imprevisivel', 0.97, '#1f4fd0', 'Chuva é meu clima favorito.'), stages: [st('city', 4, { weather: 'rain', traffic: 7 }), st('city', 4, { weather: 'rain', night: true, police: 2 })] },
      { id: 'm5', name: 'Dama da Noite', prize: 140000, boss: true, driver: drv('Dama da Noite', 'silber-95', 'cauteloso', 0.965, '#d01818', 'A cidade dorme. Eu não.'), stages: [st('city', 4, { night: true, traffic: 8, police: 2 }), st('city', 4, { weather: 'rain', night: true }), st('city', 4, { night: true, police: 3 })] },
    ],
  },
  {
    id: 'cume', name: 'Cume Gelado', desc: 'Serra, neve e o lendário Rei da Serra.', color: '#e0e8f0',
    events: [
      { id: 'g1', name: 'Primeira Neve', prize: 70000, driver: drv('Ulf Gelo', 'toro-v12', 'cauteloso', 0.97, '#ececec', 'Na neve, quem corre muito, para.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.2, hilliness: 0.9 })] },
      { id: 'g2', name: 'Curva do Abismo', prize: 80000, driver: drv('Paulo Penhasco', 'silber-95', 'agressivo', 0.98, '#d81a12', 'Olha pra frente, não pra baixo.'), stages: [st('mountain', 2, { curviness: 1.5, hilliness: 1 }), st('snow', 2, { weather: 'snow' })] },
      { id: 'g3', name: 'Tempestade Branca', prize: 90000, driver: drv('Yuki Nevasca', 'furia-f4', 'imprevisivel', 0.98, '#18b8d0', 'Você não vai me ver chegar.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.3 }), st('mountain', 2, { weather: 'rain', curviness: 1.4 })] },
      { id: 'g4', name: 'Noite na Serra', prize: 100000, driver: drv('Lobo Solitário', 'furia-f4', 'agressivo', 0.985, '#1c1c20', 'Uuuuuu.'), stages: [st('mountain', 2, { night: true, curviness: 1.5 }), st('snow', 2, { night: true, weather: 'snow' })] },
      { id: 'g5', name: 'Rei da Serra', prize: 250000, boss: true, driver: drv('Rei da Serra', 'furia-f4', 'agressivo', 0.995, '#f0c000', 'Chegou longe. Mas aqui termina.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.4, hilliness: 1 }), st('mountain', 2, { curviness: 1.6, hilliness: 1, weather: 'rain' }), st('mountain', 2, { night: true, curviness: 1.5 })] },
    ],
  },
];

// ---------- melhorias ----------
export type Upgrade = 'motor' | 'cambio' | 'pneus';
export const UPGRADES: { id: Upgrade; name: string; desc: string }[] = [
  { id: 'motor', name: 'Motor', desc: '+velocidade máxima e +força' },
  { id: 'cambio', name: 'Câmbio', desc: '+aceleração' },
  { id: 'pneus', name: 'Pneus', desc: '+aderência nas curvas' },
];
export const MAX_LEVEL = 3;
export const priceOf = (car: CarSpec) => Number(car.price.replace(/\D/g, ''));
export const upgradeCost = (car: CarSpec, level: number) => Math.round((priceOf(car) * 0.07 * level) / 500) * 500;
export const sellValue = (car: CarSpec) => Math.round((priceOf(car) * 0.6) / 1000) * 1000;
export const START_MONEY = 65000;

// carro com as melhorias aplicadas (mesmo id: pintura, cabine e sprites continuam os mesmos)
export function tunedCar(car: CarSpec, lv: Record<Upgrade, number>): CarSpec {
  return {
    ...car,
    maxSpeed: car.maxSpeed * (1 + 0.035 * lv.motor),
    accel: car.accel * (1 + 0.03 * lv.motor + 0.05 * lv.cambio),
    handling: car.handling * (1 + 0.07 * lv.pneus),
  };
}

// ---------- save ----------
export interface CareerSave {
  money: number;
  owned: string[];
  car: string; // carro ativo
  upgrades: Record<string, Record<Upgrade, number>>;
  done: string[]; // eventos vencidos
  wins: number;
  races: number;
  earned: number;
}

const KEY = 'duel-racer:career';
export function loadCareer(): CareerSave | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && typeof s.money === 'number' ? s : null;
  } catch {
    return null;
  }
}
export function saveCareer(s: CareerSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
export function newCareer(): CareerSave {
  return { money: START_MONEY, owned: [], car: '', upgrades: {}, done: [], wins: 0, races: 0, earned: 0 };
}

export const levels = (s: CareerSave, id: string): Record<Upgrade, number> => s.upgrades[id] ?? { motor: 0, cambio: 0, pneus: 0 };
export const carById = (id: string) => CARS.find((c) => c.id === id)!;

// região liberada quando o chefão da anterior foi vencido
export function regionUnlocked(s: CareerSave, ri: number) {
  return ri === 0 || REGIONS[ri - 1].events.some((e) => e.boss && s.done.includes(e.id));
}
// eventos em ordem: cada um libera o seguinte; o chefão exige os quatro anteriores
export function eventUnlocked(s: CareerSave, ri: number, ei: number) {
  if (!regionUnlocked(s, ri)) return false;
  const evs = REGIONS[ri].events;
  if (evs[ei].boss) return evs.filter((e) => !e.boss).every((e) => s.done.includes(e.id));
  return ei === 0 || s.done.includes(evs[ei - 1].id);
}

// percurso de corrida para um evento (semente própria para cada evento)
export function eventCourse(ev: CareerEvent, attempt = 0): Course {
  let seed = 0;
  for (const ch of ev.id) seed = seed * 31 + ch.charCodeAt(0);
  seed += attempt * 7919; // trânsito e polícia mudam a cada tentativa (as pistas também)
  return { id: `car-${ev.id}`, name: ev.name, level: ev.boss ? 'Chefão' : 'Evento', rivalSkill: ev.driver.skill, stages: ev.stages, seed };
}

// ---------- resultado ----------
export interface EventResult {
  won: boolean;
  gameOver: boolean;
  prize: number;
  clean: number; // bônus por trechos limpos
  fines: number;
  repairs: number;
  total: number;
  firstWin: boolean;
}

export function settleEvent(s: CareerSave, ev: CareerEvent, won: boolean, gameOver: boolean, cleanStages: number, fines: number, crashes: number): EventResult {
  const firstWin = won && !s.done.includes(ev.id);
  // vitória: prêmio (metade na repetição); derrota terminando a prova: 15% de participação
  const prize = won ? (firstWin ? ev.prize : Math.round(ev.prize / 2 / 500) * 500) : gameOver ? 0 : Math.round((ev.prize * 0.15) / 100) * 100;
  const clean = won ? Math.round((ev.prize * 0.1 * cleanStages) / 100) * 100 : 0;
  const repairs = Math.round((priceOf(carById(s.car)) * 0.01 * crashes) / 100) * 100;
  fines = Math.max(0, fines);
  const total = prize + clean - fines - repairs;
  s.money = Math.max(0, s.money + total);
  s.races++;
  if (won) {
    s.wins++;
    if (firstWin) s.done.push(ev.id);
  }
  s.earned += Math.max(0, prize + clean);
  saveCareer(s);
  return { won, gameOver, prize, clean, fines, repairs, total, firstWin };
}
