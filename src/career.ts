// Modo Carreira: regiões com eventos contra pilotos com nome, dinheiro, concessionária,
// garagem (pintura e melhorias) e progresso salvo no aparelho.
import { applyBuild, type Build } from './tuning';
import { CARS, PERF_CLASSES, prepareCar, type CarSpec, type PerfClass } from './cars';
import type { Course, StageDef } from './courses';
import type { RivalStyle } from './race';
import type { ThemeId } from './themes';

export interface Driver { name: string; car: string; style: RivalStyle; skill: number; paint: string; quote: string }
export interface CareerEvent { id: string; name: string; driver: Driver; stages: StageDef[]; prize: number; boss?: boolean }
// after: região cujo chefão libera esta (sem isso, a anterior da lista)
export interface Region { id: string; cls: PerfClass; name: string; desc: string; color: string; events: CareerEvent[]; after?: string }

const st = (theme: ThemeId, lanes: 2 | 4, extra: Partial<StageDef> = {}): StageDef => ({
  theme, lanes, curviness: 1, hilliness: 0.5, sections: 10, traffic: lanes === 4 ? 6 : 4, police: 1, ...extra,
});
const drv = (name: string, car: string, style: RivalStyle, skill: number, paint: string, quote: string): Driver =>
  ({ name, car, style, skill, paint, quote });

// Campeonato por classes: começa na D com carro fraco contra rivais de carro fraco e sobe D, C, B, A, S.
// Cada região é de uma classe (os rivais correm com carros dela) e só aceita carro da mesma classe ou
// abaixo (medida com as peças instaladas). Os prêmios de cada classe pagam o carro da classe seguinte.
export const REGIONS: Region[] = [
  {
    id: 'costa', cls: 'D', name: 'Costa do Sol', desc: 'Estradas à beira-mar, trânsito leve.', color: '#3a8ad0',
    events: [
      { id: 'D-c1', name: 'Racha da Orla', prize: 3000, driver: drv('Dudu Pneu', 'br-voyage', 'cauteloso', 0.86, '#1a9a3a', 'Vai com calma, novato.'), stages: [st('coast', 2, { dusk: true, curviness: 0.6, police: 0, traffic: 3, sections: 8 })] },
      { id: 'D-c2', name: 'Farol Vermelho', prize: 4000, driver: drv('Lia Faísca', 'br-pumagte', 'imprevisivel', 0.885, '#ececec', 'Hoje eu tô inspirada!'), stages: [st('coast', 2, { dusk: true, curviness: 0.8, traffic: 3 })] },
      { id: 'D-c3', name: 'Coqueiral', prize: 5000, driver: drv('Beto Turbo', 'br-passat', 'agressivo', 0.91, '#d01818', 'Sai da minha frente!'), stages: [st('coast', 4, { curviness: 0.7 }), st('forest', 2, { night: true, curviness: 0.7, police: 0 })] },
      { id: 'D-c4', name: 'Pôr do Sol', prize: 6000, driver: drv('Nina Maresia', 'br-voyagesport', 'cauteloso', 0.93, '#18b8d0', 'Constância vence corrida.'), stages: [st('coast', 2, { curviness: 1, tod: 'sunset' }), st('coast', 2, { night: true, curviness: 0.9 })] },
      { id: 'D-c5', name: 'Rei da Praia', prize: 12000, boss: true, driver: drv('Capitão Maré', 'br-monza', 'agressivo', 0.95, '#1f4fd0', 'Esta costa é minha há dez anos.'), stages: [st('coast', 4, { curviness: 0.9 }), st('coast', 2, { curviness: 1.1, weather: 'rain' }), st('forest', 2, { night: true, curviness: 1 })] },
    ],
  },
  {
    id: 'vale', cls: 'D', name: 'Vale Verde', desc: 'Fazendas, colinas e pontes.', color: '#58a83a',
    events: [
      { id: 'D-v1', name: 'Estrada do Celeiro', prize: 4000, driver: drv('Zé Trator', 'br-santana', 'agressivo', 0.92, '#d8c49a', 'Aqui é terra de gente bruta.'), stages: [st('farm', 2, { dusk: true, hilliness: 0.8 })] },
      { id: 'D-v2', name: 'Colheita Rápida', prize: 5000, driver: drv('Rosa Vento', 'br-monzacoupe', 'cauteloso', 0.93, '#7a3ac8', 'Respeite as curvas.'), stages: [st('farm', 2, { hilliness: 0.9, curviness: 1.1 }), st('forest', 2, { night: true })] },
      { id: 'D-v3', name: 'Ponte Velha', prize: 6000, driver: drv('Tico Nitro', 'br-pumagtb', 'imprevisivel', 0.94, '#f0c000', 'Nem eu sei o que vou fazer.'), stages: [st('forest', 4, { tod: 'dawn' }), st('farm', 2, { night: true })] },
      { id: 'D-v4', name: 'Serra Baixa', prize: 7000, driver: drv('Marta Freio', 'br-voyagesport', 'cauteloso', 0.94, '#8a8c92', 'Frear também é pilotar.'), stages: [st('forest', 2, { curviness: 1.2, hilliness: 0.9 }), st('farm', 4, { night: true })] },
      { id: 'D-v5', name: 'Barão do Vale', prize: 15000, boss: true, driver: drv('Barão do Vale', 'br-monza', 'agressivo', 0.96, '#1c1c20', 'Minha fazenda, minhas regras.'), stages: [st('farm', 2, { hilliness: 1 }), st('forest', 2, { night: true, curviness: 1.1 }), st('farm', 4, { weather: 'rain' })] },
    ],
  },
  {
    // biomas novos; clima e hora do dia definidos pela dificuldade do evento
    id: 'tropico', cls: 'C', name: 'Trópico Selvagem', desc: 'Praias, savana, selva e cânion.', color: '#f0a030',
    events: [
      { id: 'C-t1', name: 'Areia Dourada', prize: 6000, driver: drv('Surfista Léo', 'br-corsa', 'cauteloso', 0.93, '#18b8d0', 'A onda boa é a da estrada.'), stages: [st('beach', 4, { curviness: 0.7, police: 0, tod: 'sunset' }), st('beach', 2, { night: true, curviness: 0.8 })] },
      { id: 'C-t2', name: 'Safári', prize: 8000, driver: drv('Juba', 'br-kadett', 'agressivo', 0.94, '#c8a840', 'O rei da savana sou eu.'), stages: [st('savanna', 2, { curviness: 0.8, hilliness: 0.7 }), st('savanna', 4, { night: true, curviness: 0.6 })] },
      { id: 'C-t3', name: 'Chuva na Selva', prize: 10000, driver: drv('Tucano', 'br-uno', 'imprevisivel', 0.945, '#1a9a3a', 'Na mata ninguém me acha.'), stages: [st('jungle', 2, { curviness: 1.1, weather: 'rain' }), st('jungle', 2, { night: true, curviness: 1.2, weather: 'rain' })] },
      { id: 'C-t4', name: 'Pôr do Sol no Cânion', prize: 12000, driver: drv('Coiote', 'br-golgti', 'agressivo', 0.95, '#c8603a', 'Bip bip? Não comigo.'), stages: [st('canyon', 2, { curviness: 1.2, hilliness: 0.9, tod: 'sunset' }), st('canyon', 2, { curviness: 1.3, night: true })] },
      { id: 'C-t5', name: 'Rainha do Trópico', prize: 25000, boss: true, driver: drv('Rainha Jaci', 'br-vectra', 'cauteloso', 0.955, '#f0a030', 'Do mar ao cânion, tudo é meu.'), stages: [st('beach', 4, { curviness: 0.9 }), st('jungle', 2, { curviness: 1.3, weather: 'rain' }), st('canyon', 2, { curviness: 1.4, night: true, hilliness: 1 })] },
    ],
  },
  {
    id: 'deserto', cls: 'C', name: 'Rota do Deserto', desc: 'Retas longas, calor e polícia.', color: '#d0a860',
    events: [
      { id: 'C-d1', name: 'Miragem', prize: 8000, driver: drv('Sol Escaldante', 'br-uno', 'agressivo', 0.94, '#f0c000', 'O asfalto derrete, eu não.'), stages: [st('desert', 4, { dusk: true, police: 2 })] },
      { id: 'C-d2', name: 'Cânion', prize: 10000, driver: drv('Kiko Poeira', 'br-corsa', 'imprevisivel', 0.945, '#d8c49a', 'Cuidado com a poeira!'), stages: [st('desert', 2, { curviness: 1.2, hilliness: 0.8, tod: 'dawn' }), st('desert', 2, { night: true, police: 2 })] },
      { id: 'C-d3', name: 'Oásis Noturno', prize: 12000, driver: drv('Vera Lua', 'br-kadett', 'cauteloso', 0.95, '#7a3ac8', 'A noite é minha aliada.'), stages: [st('desert', 4, { night: true }), st('desert', 2, { night: true, curviness: 1.1 })] },
      { id: 'C-d4', name: 'Tempestade de Areia', prize: 15000, driver: drv('Tenente Brasa', 'patrol', 'agressivo', 0.955, '#f2f2f2', 'Racha na minha rodovia? Então vamos correr.'), stages: [st('desert', 2, { curviness: 1.3 }), st('desert', 4, { night: true, police: 2 })] },
      { id: 'C-d5', name: 'O Escorpião', prize: 30000, boss: true, driver: drv('Escorpião', 'br-golgti', 'agressivo', 0.96, '#1c1c20', 'Ninguém atravessa o deserto na minha frente.'), stages: [st('desert', 4, { police: 2 }), st('desert', 2, { curviness: 1.3, hilliness: 0.9 }), st('desert', 2, { night: true, curviness: 1.2 })] },
    ],
  },
  {
    id: 'metropole', cls: 'B', name: 'Metrópole', desc: 'Avenidas cheias, viadutos e noite.', color: '#8a8aa8',
    events: [
      { id: 'B-m1', name: 'Hora do Rush', prize: 20000, driver: drv('Táxi Veloz', 'serpe-v10', 'imprevisivel', 0.95, '#f0c000', 'Corrida até o aeroporto?'), stages: [st('city', 4, { dusk: true, traffic: 8, police: 2 })] },
      { id: 'B-m2', name: 'Avenida Neon', prize: 25000, driver: drv('Dani Neon', 'kaze-nx', 'cauteloso', 0.96, '#18b8d0', 'Luzes, câmera, aceleração.'), stages: [st('city', 4, { night: true, traffic: 7 }), st('city', 4, { night: true, police: 2 })] },
      { id: 'B-m3', name: 'Túnel do Centro', prize: 30000, driver: drv('Capitã Sirene', 'furia-tr', 'agressivo', 0.96, '#f2f2f2', 'Se ganhar de mim, a multa fica pra outro dia.'), stages: [st('city', 4, { traffic: 8, tod: 'dawn' }), st('forest', 4, { night: true })] },
      { id: 'B-m4', name: 'Chuva no Asfalto', prize: 35000, driver: drv('Iara Tormenta', 'kaze-nx', 'imprevisivel', 0.97, '#1f4fd0', 'Chuva é meu clima favorito.'), stages: [st('city', 4, { weather: 'rain', traffic: 7 }), st('city', 4, { weather: 'rain', night: true, police: 2 })] },
      { id: 'B-m5', name: 'Dama da Noite', prize: 80000, boss: true, driver: drv('Dama da Noite', 'furia-tr', 'cauteloso', 0.965, '#d01818', 'A cidade dorme. Eu não.'), stages: [st('city', 4, { night: true, traffic: 8, police: 2 }), st('city', 4, { weather: 'rain', night: true }), st('city', 4, { night: true, police: 3 })] },
    ],
  },
  {
    id: 'fronteira', cls: 'A', name: 'Fronteira Norte', desc: 'Outono, indústrias, penhascos e Alpes.', color: '#6aa0d0',
    events: [
      { id: 'A-f1', name: 'Folhas ao Vento', prize: 40000, driver: drv('Outonal', 'vortex-zr', 'cauteloso', 0.965, '#d07a2a', 'Cada curva, uma folha.'), stages: [st('autumn', 2, { curviness: 1.1, hilliness: 0.8, tod: 'sunset' }), st('autumn', 4, { night: true, curviness: 0.9 })] },
      { id: 'A-f2', name: 'Turno da Noite', prize: 50000, driver: drv('Operário', 'toro-lp5', 'agressivo', 0.97, '#7a7a6a', 'Bati o ponto. Agora é corrida.'), stages: [st('industrial', 4, { night: true, traffic: 8, police: 2 }), st('industrial', 4, { night: true, police: 2 })] },
      { id: 'A-f3', name: 'Neblina na Metrópole', prize: 60000, driver: drv('Fantasma', 'vortex-zr', 'imprevisivel', 0.975, '#ececec', 'Você vai ouvir, mas não vai ver.'), stages: [st('city', 4, { weather: 'rain', traffic: 9, police: 2 }), st('industrial', 4, { weather: 'rain', night: true, police: 3 })] },
      { id: 'A-f4', name: 'Beira do Abismo', prize: 70000, driver: drv('Águia', 'toro-lp5', 'agressivo', 0.98, '#d81a12', 'Lá de cima eu vejo tudo.'), stages: [st('mountain', 2, { curviness: 1.7, hilliness: 1 }), st('coast', 2, { curviness: 1.6, weather: 'rain', night: true })] },
      { id: 'A-f5', name: 'Barão dos Alpes', prize: 150000, boss: true, driver: drv('Barão Gélido', 'vortex-zr', 'agressivo', 0.99, '#6aa0d0', 'Lá no alto o ar é rarefeito. Para você.'), stages: [st('alpine', 2, { curviness: 1.5, hilliness: 1 }), st('alpine', 2, { curviness: 1.6, weather: 'rain', night: true }), st('alpinesnow', 2, { weather: 'snow', curviness: 1.5, hilliness: 1 })] },
    ],
  },
  {
    id: 'cume', cls: 'S', name: 'Cume Gelado', desc: 'Serra, neve e o lendário Rei da Serra.', color: '#e0e8f0',
    events: [
      { id: 'S-g1', name: 'Primeira Neve', prize: 70000, driver: drv('Ulf Gelo', 'toro-v12', 'cauteloso', 0.97, '#ececec', 'Na neve, quem corre muito, para.'), stages: [st('snow', 2, { dusk: true, weather: 'snow', curviness: 1.2, hilliness: 0.9 })] },
      { id: 'S-g2', name: 'Curva do Abismo', prize: 80000, driver: drv('Paulo Penhasco', 'silber-95', 'agressivo', 0.98, '#d81a12', 'Olha pra frente, não pra baixo.'), stages: [st('mountain', 2, { curviness: 1.5, hilliness: 1, tod: 'dawn' }), st('snow', 2, { night: true, weather: 'snow' })] },
      { id: 'S-g3', name: 'Tempestade Branca', prize: 90000, driver: drv('Capitã Sirene', 'patrol-sv', 'imprevisivel', 0.98, '#f2f2f2', 'Na serra também tem lei.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.3 }), st('mountain', 2, { night: true, weather: 'rain', curviness: 1.4 })] },
      { id: 'S-g4', name: 'Noite na Serra', prize: 100000, driver: drv('Lobo Solitário', 'silber-95', 'agressivo', 0.985, '#1c1c20', 'Uuuuuu.'), stages: [st('mountain', 2, { night: true, curviness: 1.5 }), st('snow', 2, { night: true, weather: 'snow' })] },
      { id: 'S-g5', name: 'Rei da Serra', prize: 250000, boss: true, driver: drv('Rei da Serra', 'furia-f4', 'agressivo', 0.995, '#f0c000', 'Chegou longe. Mas aqui termina.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.4, hilliness: 1 }), st('mountain', 2, { curviness: 1.6, hilliness: 1, weather: 'rain' }), st('mountain', 2, { night: true, curviness: 1.5 })] },
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
export const START_MONEY = 20000; // dá para um carro da classe D (o primeiro da carreira)
// a classe do carro (com as peças) cabe na região? (carro de classe abaixo também corre)
export const classFits = (carCls: PerfClass, regionCls: PerfClass) => PERF_CLASSES.indexOf(carCls) <= PERF_CLASSES.indexOf(regionCls);

// carro com as melhorias aplicadas (mesmo id: pintura, cabine e sprites continuam os mesmos)
// Ajustes da oficina (de graça, mudam a qualquer hora): relação de marchas, suspensão e rodas
export interface Setup { ratio: number; susp: number; rims: string } // ratio -1 curta, 0, 1 longa; susp 0..2
export const DEFAULT_SETUP: Setup = { ratio: 0, susp: 0, rims: '' };
export const RATIO_LABEL = ['CURTA', 'ORIGINAL', 'LONGA'];
export const SUSP_LABEL = ['ORIGINAL', 'ESPORTIVA', 'REBAIXADA'];
export const setupOf = (cs: CareerSave, id: string): Setup => ({ ...DEFAULT_SETUP, ...(cs.setup?.[id] ?? {}) });
export const buildOf = (cs: CareerSave, id: string): Build => cs.builds?.[id] ?? {};

export function tunedCar(car0: CarSpec, _lv?: unknown, st: Setup = DEFAULT_SETUP, build?: Build): CarSpec {
  // as peças da preparação (tuning.ts) são o único caminho de melhoria; aqui entram os ajustes de graça:
  // relação curta arranca mais e perde máxima, longa o contrário
  const car = applyBuild(car0, build);
  const tuned: CarSpec = {
    ...car,
    rims: st.rims || undefined,
    maxSpeed: car.maxSpeed * (1 + 0.04 * st.ratio),
    accel: car.accel * (1 - 0.055 * st.ratio),
  };
  return prepareCar(tuned);
}

// ---------- save ----------
export interface CareerSave {
  money: number;
  owned: string[];
  car: string; // carro ativo
  upgrades: Record<string, Record<Upgrade, number>>;
  setup?: Record<string, Setup>; // ajustes da oficina por carro
  builds?: Record<string, Build>; // peças instaladas (preparação) por carro
  parts?: Record<string, string[]>; // peças já compradas por carro ("vaga:peça"): trocar de volta não cobra de novo
  done: string[]; // eventos vencidos
  wins: number;
  races: number;
  earned: number;
}

const KEY = 'duel-racer:career';
// FASE DE TESTES (pedido do Victor): toda carreira, nova ou salva, tem pelo menos este saldo para
// experimentar carros e peças. Pôr 0 para desligar quando os testes acabarem.
export const TEST_MONEY = 1_000_000;
export function loadCareer(): CareerSave | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || typeof s.money !== 'number') return null;
    // melhorias genéricas antigas (motor/câmbio/pneus por nível) saíram: o que foi gasto volta em dinheiro
    for (const [id, lv] of Object.entries((s.upgrades ?? {}) as Record<string, Record<string, number>>)) {
      const car = CARS.find((c) => c.id === id);
      if (car) for (const l of Object.values(lv)) for (let k = 1; k <= l; k++) s.money += upgradeCost(car, k);
    }
    s.upgrades = {};
    // o Ímola de quatro portas saiu do jogo: quem tinha fica com o cupê (mesma ficha), peças e cor juntas
    const OLD = 'br-monzasedan', NEW = 'br-monzacoupe';
    if (Array.isArray(s.owned) && s.owned.includes(OLD)) {
      s.owned = s.owned.filter((id: string) => id !== OLD);
      if (!s.owned.includes(NEW)) {
        s.owned.push(NEW);
        for (const k of ['builds', 'parts', 'setup', 'paint'] as const) if (s[k]?.[OLD] !== undefined && s[k][NEW] === undefined) s[k][NEW] = s[k][OLD];
      }
      for (const k of ['builds', 'parts', 'setup', 'paint'] as const) if (s[k]) delete s[k][OLD];
    }
    if (s.car === OLD) s.car = NEW;
    if (s.money < TEST_MONEY) s.money = TEST_MONEY;
    return s;
  } catch {
    return null;
  }
}
export function saveCareer(s: CareerSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // armazenamento cheio (fantasmas e recordes ocupam espaço): a carreira tem a vez; os fantasmas saem
    try {
      localStorage.removeItem('duel-racer:fantasmas');
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }
}
export function newCareer(): CareerSave {
  return { money: Math.max(START_MONEY, TEST_MONEY), owned: [], car: '', upgrades: {}, done: [], wins: 0, races: 0, earned: 0 };
}

export const levels = (s: CareerSave, id: string): Record<Upgrade, number> => s.upgrades[id] ?? { motor: 0, cambio: 0, pneus: 0 };
export const carById = (id: string) => CARS.find((c) => c.id === id)!;

// região liberada quando o chefão da região indicada (ou da anterior) foi vencido
export function regionUnlocked(s: CareerSave, ri: number) {
  if (ri === 0) return true;
  const prev = REGIONS.find((r) => r.id === REGIONS[ri].after) ?? REGIONS[ri - 1];
  return prev.events.some((e) => e.boss && s.done.includes(e.id));
}
// regiões que o chefão desta libera
export const regionsAfter = (ri: number) => REGIONS.filter((r, i) => i > 0 && (r.after ?? REGIONS[i - 1].id) === REGIONS[ri].id);
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
