import { stageResult } from './score';
import '@fontsource/press-start-2p/400.css';
import { RES, view } from './config';
import { CARS, TRAFFIC_IMAGES } from './cars';
import { COURSES, completeCourse, unlockedCourses, withTimeOfDay, type Course } from './courses';
import { ui as careerUi } from './careerScreens';
import { REGIONS, carById, eventCourse, levels, loadCareer, saveCareer, settleEvent, tunedCar } from './career';
import type { CarSpec } from './cars';
import { Race } from './race';
import { loadGhost, saveRun } from './records';
import { CHALLENGE_PRIZE, checkChallenge, saveMedal, stageAchievements, stageChallenges, toast } from './challenges';
import { paintHex } from './paint';
import { preloadCockpit, renderCockpit } from './cockpit';
import { applyBtnSize, drawScreen, drawToast, keyScreen, saveScore, tapScreen, type Actions, type AppState, type MenuKey, type ScreenId } from './screens';
import { input, pollGamepad, releaseAll, setupInput } from './input';
import { initAudio, playMusic, setEngine, setMusicOn, setMuted, setSiren, setTires } from './audio';
import { stopTrafficAudio } from './trafficaudio';
import { preloadSvg } from './svgsprites';
import { perfSample } from './perf';
import { F40_REAR, F40_SIDE, F40_WHEEL } from './svg/f40';

preloadSvg(F40_SIDE, F40_REAR, F40_WHEEL, ...CARS.flatMap((c) => [c.imgSide, c.sideMask, c.rear.img, c.rear.imgMask, c.rear.frontImg, c.rear.frontMask]).filter((s): s is string => !!s), ...TRAFFIC_IMAGES);

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const $ = (id: string) => document.getElementById(id)!;

const state: AppState = {
  screen: 'title', t: 0, sel: 1, auto: true, sound: true, music: true,
  carIdx: 0, oppIdx: 0, courseIdx: 0, scoreCourse: 0,
  lives: 5, results: [], gameOver: false,
  mode: 'arcade', career: loadCareer(), careerResult: null, gasPage: 0, arcadeNight: false, courseTop: 0, newMap: null, lockedT: 0, carFilter: null, oppFilter: null,
};

// corrida em andamento: percurso, carro (com melhorias, na carreira) e rival
interface Run {
  course: Course;
  car: CarSpec;
  rival: CarSpec | null;
  opts: { rivalStyle?: import('./race').RivalStyle; rivalPaint?: string };
  event?: { region: number; event: number };
}
let run: Run = { course: COURSES[0], car: CARS[0], rival: null, opts: {} };
let race: Race | null = null;
let liveDone = new Set<number>(); // desafios do trecho já avisados
let paused = false;

const totalTime = () => state.results.reduce((a, r) => a + r.time, 0);

function showControls(on: boolean) {
  $('controls').classList.toggle('hidden', !on);
  $('pauseBtn').classList.toggle('hidden', !on);
  $('gearBtns').classList.toggle('hidden', state.auto);
  $('pause').classList.add('hidden');
  paused = false;
}

const actions: Actions = {
  go(s: ScreenId) {
    state.screen = s;
    resize();
    state.sel = s === 'title' ? 1 : s === 'course' ? unlockedCourses() - 1 : 0; // percursos: já no mapa liberado mais novo
    state.lockedT = 0;
    showControls(false);
    setEngine(0, false, false);
    stopTrafficAudio();
    setSiren(false);
    setTires(0, 0);
    playMusic('menu');
  },
  startCourse() {
    state.mode = 'arcade';
    run = {
      course: withTimeOfDay(COURSES[state.courseIdx], state.arcadeNight), car: CARS[state.carIdx],
      rival: state.oppIdx < CARS.length ? CARS[state.oppIdx] : null, opts: {},
    };
    begin(5);
  },
  startEvent(region: number, event: number) {
    const cs = state.career!;
    const ev = REGIONS[region].events[event];
    careerUi.region = region;
    careerUi.event = event;
    state.mode = 'career';
    state.carIdx = CARS.findIndex((c) => c.id === cs.car);
    run = {
      course: eventCourse(ev, cs.races), car: tunedCar(carById(cs.car), levels(cs, cs.car)), rival: carById(ev.driver.car),
      opts: { rivalStyle: ev.driver.style, rivalPaint: ev.driver.paint }, event: { region, event },
    };
    begin(4);
  },
  nextStage() {
    if (state.results.length >= run.course.stages.length) finishCourse();
    else startStage(state.results.length);
  },
  toggleSound() {
    state.sound = !state.sound;
    setMuted(!state.sound);
  },
  toggleMusic() {
    state.music = !state.music;
    setMusicOn(state.music);
  },
};

function begin(lives: number) {
  initAudio();
  state.lives = lives;
  state.results = [];
  state.gameOver = false;
  state.newMap = null;
  startStage(0);
}

function startStage(i: number) {
  preloadCockpit(run.car.dash);
  const r = new Race(run.course, i, run.car, run.rival, state.auto, run.opts);
  r.ghostRun = loadGhost(run.course.id, i);
  r.challenges = stageChallenges(r);
  liveDone = new Set();
  r.onArrive = () => {
    const res = stageResult(r);
    const sv = saveRun(r, run.course.id, i, paintHex(run.car.id));
    res.best = sv.prev;
    res.record = sv.record;
    // desafios do trecho: medalha (1 bronze, 2 prata, 3 ouro) e, na carreira, dinheiro
    res.challenges = r.challenges.map((ch) => ({ label: ch.label, done: checkChallenge(ch, r, true) }));
    const medal = res.challenges.filter((q) => q.done).length;
    res.medal = medal;
    res.medalNew = saveMedal(run.course.id, i, medal);
    if (state.mode === 'career' && state.career && medal) {
      res.prize = medal * CHALLENGE_PRIZE;
      state.career.money += res.prize;
      saveCareer(state.career);
    }
    stageAchievements(r, {
      won: res.rival >= 0 && res.time <= res.rival, record: sv.record && sv.prev !== undefined, medal,
      unlocked: unlockedCourses(), legend: run.course.id === 'lendas' && i === run.course.stages.length - 1,
    });
    state.results.push(res);
    if (r.clean) state.lives++;
    state.gasPage = 0;
    actions.go('gas');
  };
  r.onCrash = () => {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      if (state.mode === 'career') settle(false, r);
      else actions.go('end');
    }
  };
  race = r;
  releaseAll();
  state.screen = 'race';
  resize();
  showControls(true);
  playMusic(`r${(run.event ? run.event.region : state.courseIdx) % 4}`);
}

// resultado de um evento da carreira (dinheiro, prêmio, progresso)
function settle(won: boolean, last?: Race) {
  const ev = REGIONS[run.event!.region].events[run.event!.event];
  const res = state.results;
  const fines = res.reduce((a, r) => a + (r.fines ?? 0), 0) + (last && state.gameOver ? last.fines : 0);
  const crashes = res.reduce((a, r) => a + r.crashes, 0) + (last && state.gameOver ? last.crashes : 0);
  state.careerResult = settleEvent(state.career!, ev, won, state.gameOver, res.filter((r) => r.clean).length, fines, crashes);
  actions.go('careerEnd');
}

function finishCourse() {
  if (state.mode === 'career') {
    const total = totalTime();
    const rival = state.results.reduce((a, r) => a + Math.max(0, r.rival), 0);
    settle(total <= rival);
    return;
  }
  const course = COURSES[state.courseIdx];
  const total = totalTime();
  const rivalOk = state.results.every((r) => r.rival >= 0);
  const rival = state.results.reduce((a, r) => a + r.rival, 0);
  // percurso concluído: libera o próximo mapa
  state.newMap = completeCourse(state.courseIdx) ? COURSES[state.courseIdx + 1].name : null;
  saveScore(course, { time: total, car: CARS[state.carIdx].name, won: !rivalOk || total <= rival, score: state.results.reduce((a, r) => a + r.score, 0) });
  actions.go('end');
}

// elemento invisível com as margens da área segura (env() só vira número no CSS)
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;inset:0;padding:var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l)';
document.body.appendChild(safeProbe);

function resize() {
  // corrida: resolução nativa do Super Nintendo (224 linhas, pixel 8:7 como na TV);
  // menus: 240 linhas com pixel quadrado
  const race = state.screen === 'race';
  view.h = race ? 224 : 240;
  view.aspect = race ? 8 / 7 : 1;
  // área segura (entalhe do iPhone na horizontal): o jogo não entra embaixo dele
  const safe = getComputedStyle(safeProbe);
  const px = (v: string) => parseFloat(v) || 0;
  const availW = window.innerWidth - px(safe.paddingLeft) - px(safe.paddingRight);
  const availH = window.innerHeight - px(safe.paddingTop) - px(safe.paddingBottom);
  const screenAspect = availW / availH;
  view.w = Math.round(Math.min(race ? 460 : 520, Math.max(race ? 256 : 320, (view.h * screenAspect) / view.aspect)));
  // resolução interna 2x: tudo continua desenhado em pixels nativos (e ampliado sem
  // suavizar), mas os detalhes finos (números dos mostradores) podem usar meio pixel
  canvas.width = view.w * RES;
  canvas.height = view.h * RES;
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(availW / (view.w * view.aspect), availH / view.h);
  canvas.style.width = `${view.w * view.aspect * scale}px`;
  canvas.style.height = `${view.h * scale}px`;
}

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (state.screen === 'race') return;
  const rect = canvas.getBoundingClientRect();
  tapScreen(state, actions, ((e.clientX - rect.left) / rect.width) * view.w, ((e.clientY - rect.top) / rect.height) * view.h);
});

const MENU_KEYS: Record<string, MenuKey> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Enter: 'ok', Space: 'ok', Escape: 'back', Backspace: 'back',
};
window.addEventListener('keydown', (e) => {
  if (state.screen === 'race') {
    if (e.code === 'Escape') setPaused(!paused);
    return;
  }
  const k = MENU_KEYS[e.code];
  if (k) {
    initAudio();
    keyScreen(state, actions, k);
  }
});

function setPaused(p: boolean) {
  paused = p;
  $('pause').classList.toggle('hidden', !p);
  if (p) {
    setEngine(0, false, false);
    stopTrafficAudio();
    setSiren(false);
    releaseAll();
  }
}
$('pauseBtn').addEventListener('click', () => setPaused(true));
$('resume').addEventListener('click', () => setPaused(false));
$('quit').addEventListener('click', () => actions.go('title'));

setupInput();
window.addEventListener('resize', resize);
resize();

// laço principal com física em passo fixo (60 Hz)
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
function frame(now: number) {
  // um erro num quadro (desenho, áudio) não pode parar o jogo: registra e segue no próximo
  try {
    frameInner(now);
  } catch (e) {
    if (!frameErr) console.error(e);
    frameErr = true;
  }
  requestAnimationFrame(frame);
}
let frameErr = false;
function frameInner(now: number) {
  const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); // o primeiro quadro pode vir antes de `last`
  last = now;
  state.t += dt;
  // controle Bluetooth: na corrida mexe direto nos comandos; nos menus vira navegação
  for (const k of pollGamepad()) {
    if (state.screen === 'race') {
      if (k === 'start') setPaused(!paused);
      else if (paused && k === 'ok') setPaused(false);
      else if (paused && k === 'back') actions.go('title');
    } else if (k !== 'start') {
      initAudio();
      keyScreen(state, actions, k);
    } else keyScreen(state, actions, 'ok');
  }
  if (state.screen === 'race' && race) {
    if (!paused) {
      acc += dt;
      while (acc >= STEP && state.screen === 'race') {
        race.update(STEP);
        acc -= STEP;
      }
    }
    // desafio que já não tem como falhar: avisa na hora em que se cumpre
    race.challenges.forEach((ch, k) => {
      if (!liveDone.has(k) && race!.state === 'drive' && checkChallenge(ch, race!, false)) {
        liveDone.add(k);
        toast('DESAFIO CUMPRIDO!', ch.label, '#30e060');
      }
    });
    if (state.screen === 'race') {
      if (!paused) perfSample(dt);
      renderCockpit(ctx, race, state.lives, `${race.stageIdx + 1}/${run.course.stages.length}`, totalTime(), paused ? 0 : dt);
    } else drawScreen(ctx, state);
  } else {
    acc = 0;
    drawScreen(ctx, state);
  }
  drawToast(ctx, dt);
}
requestAnimationFrame(frame);

// para testes automatizados
Object.assign(window, { app: { state, actions, get race() { return race; } }, input });

// app instalável: funciona sem internet (não no arquivo único usado para testes)
if ('serviceWorker' in navigator && import.meta.env.MODE !== 'single' && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
applyBtnSize(); // tamanho dos botões escolhido nas opções
