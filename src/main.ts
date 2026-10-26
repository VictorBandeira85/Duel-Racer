import '@fontsource/press-start-2p/400.css';
import { view } from './config';
import { CARS } from './cars';
import { COURSES } from './courses';
import { Race } from './race';
import { COCKPIT_IMAGES, renderCockpit } from './cockpit';
import { drawScreen, keyScreen, saveScore, tapScreen, type Actions, type AppState, type MenuKey, type ScreenId } from './screens';
import { input, releaseAll, setupInput } from './input';
import { initAudio, setEngine, setMuted, setSiren } from './audio';
import { preloadSvg } from './svgsprites';
import { F40_REAR, F40_SIDE, F40_WHEEL } from './svg/f40';

preloadSvg(F40_SIDE, F40_REAR, F40_WHEEL, ...CARS.flatMap((c) => [c.imgSide, c.rear.img, c.rear.frontImg]).filter((s): s is string => !!s), ...COCKPIT_IMAGES);

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const $ = (id: string) => document.getElementById(id)!;

const state: AppState = {
  screen: 'title', t: 0, sel: 1, auto: true, sound: true,
  carIdx: 0, oppIdx: 0, courseIdx: 0, scoreCourse: 0,
  lives: 5, results: [], gameOver: false,
};
let race: Race | null = null;
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
    state.sel = s === 'title' ? 1 : 0;
    showControls(false);
    setEngine(0, false, false);
    setSiren(false);
  },
  startCourse() {
    initAudio();
    state.lives = 5;
    state.results = [];
    state.gameOver = false;
    startStage(0);
  },
  nextStage() {
    const course = COURSES[state.courseIdx];
    if (state.results.length >= course.stages.length) finishCourse();
    else startStage(state.results.length);
  },
  toggleSound() {
    state.sound = !state.sound;
    setMuted(!state.sound);
  },
};

function startStage(i: number) {
  const course = COURSES[state.courseIdx];
  const rivalCar = state.oppIdx < CARS.length ? CARS[state.oppIdx] : null;
  const r = new Race(course, i, CARS[state.carIdx], rivalCar, state.auto);
  r.onArrive = () => {
    state.results.push({ time: r.time, rival: r.rivalTime, clean: r.clean, crashes: r.crashes, tickets: r.tickets });
    if (r.clean) state.lives++;
    actions.go('gas');
  };
  r.onCrash = () => {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      actions.go('end');
    }
  };
  race = r;
  releaseAll();
  state.screen = 'race';
  resize();
  showControls(true);
}

function finishCourse() {
  const course = COURSES[state.courseIdx];
  const total = totalTime();
  const rivalOk = state.results.every((r) => r.rival >= 0);
  const rival = state.results.reduce((a, r) => a + r.rival, 0);
  saveScore(course, { time: total, car: CARS[state.carIdx].name, won: !rivalOk || total <= rival });
  actions.go('end');
}

function resize() {
  // corrida: resolução nativa do Super Nintendo (224 linhas, pixel 8:7 como na TV);
  // menus: 240 linhas com pixel quadrado
  const race = state.screen === 'race';
  view.h = race ? 224 : 240;
  view.aspect = race ? 8 / 7 : 1;
  const screenAspect = window.innerWidth / window.innerHeight;
  view.w = Math.round(Math.min(race ? 460 : 520, Math.max(race ? 256 : 320, (view.h * screenAspect) / view.aspect)));
  canvas.width = view.w;
  canvas.height = view.h;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(window.innerWidth / (view.w * view.aspect), window.innerHeight / view.h);
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
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  state.t += dt;
  if (state.screen === 'race' && race) {
    if (!paused) {
      acc += dt;
      while (acc >= STEP && state.screen === 'race') {
        race.update(STEP);
        acc -= STEP;
      }
    }
    if (state.screen === 'race') {
      const course = COURSES[state.courseIdx];
      renderCockpit(ctx, race, state.lives, `${race.stageIdx + 1}/${course.stages.length}`, totalTime(), paused ? 0 : dt);
    } else drawScreen(ctx, state);
  } else {
    acc = 0;
    drawScreen(ctx, state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// para testes automatizados
Object.assign(window, { app: { state, actions, get race() { return race; } }, input });
