import { view } from './config';
import { Game } from './game';
import { render } from './render';
import { input, releaseAll, setupInput } from './input';
import { initAudio, setEngine, toggleMute } from './audio';
import { formatTime } from './util';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const $ = (id: string) => document.getElementById(id)!;

const game = new Game();

// recordes salvos no aparelho
const bestKey = () => `duel-racer:best:${game.stage.id}:${game.car.id}`;
const getBest = (): number | null => {
  try {
    const v = localStorage.getItem(bestKey());
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
const setBest = (t: number) => {
  try {
    localStorage.setItem(bestKey(), String(t));
  } catch {
    /* sem armazenamento disponível */
  }
};

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  view.w = Math.round(Math.min(640, Math.max(400, view.h * aspect)));
  canvas.width = view.w;
  canvas.height = view.h;
  const scale = Math.min(window.innerWidth / view.w, window.innerHeight / view.h);
  canvas.style.width = `${view.w * scale}px`;
  canvas.style.height = `${view.h * scale}px`;
}

const bar = (v: number) => '■'.repeat(v) + '□'.repeat(5 - v);

function refreshMenu() {
  $('stageName').textContent = game.stage.name;
  const best = getBest();
  $('stageBest').textContent = best ? `Recorde: ${formatTime(best)}` : '';
  const car = game.car;
  $('carName').textContent = car.name;
  const vel = Math.round(((car.maxSpeed - 10800) / 2400) * 4) + 1;
  const acc = Math.round(((car.accel - 0.8) / 0.4) * 4) + 1;
  const ctl = Math.round(((car.handling - 0.8) / 0.4) * 4) + 1;
  $('carStats').textContent = `VEL ${bar(vel)} ACEL ${bar(acc)} CONTR ${bar(ctl)}`;
  $('transBtn').textContent = `CÂMBIO: ${game.auto ? 'AUTOMÁTICO' : 'MANUAL'}`;
}

function show(id: 'menu' | 'result' | 'controls') {
  for (const el of ['menu', 'result', 'controls']) $(el).classList.toggle('hidden', el !== id);
  $('mute').classList.toggle('hidden', id === 'controls');
}

function startRace() {
  initAudio();
  releaseAll();
  game.startRace();
  $('gearBtns').classList.toggle('hidden', game.auto);
  show('controls');
}

game.onFinish = (won) => {
  const best = getBest();
  const isRecord = best === null || game.finishTime < best;
  if (isRecord) setBest(game.finishTime);
  $('resultTitle').textContent = won ? 'VITÓRIA!' : 'DERROTA';
  ($('resultTitle') as HTMLElement).style.color = won ? '#ffd400' : '#ff5a5a';
  const diff = game.rival.finishTime >= 0 ? game.finishTime - game.rival.finishTime : null;
  $('resultText').innerHTML =
    `Seu tempo: ${formatTime(game.finishTime)}${isRecord ? ' <b style="color:#30e060">NOVO RECORDE!</b>' : ''}<br>` +
    (diff === null ? 'O rival nem chegou perto.' : `Rival: ${diff > 0 ? '-' : '+'}${Math.abs(diff).toFixed(2)}s`);
  show('result');
};

document.querySelectorAll<HTMLElement>('[data-act]').forEach((el) =>
  el.addEventListener('click', () => {
    switch (el.dataset.act) {
      case 'stagePrev': game.select(game.stageIdx - 1, game.carIdx); game.toMenu(); break;
      case 'stageNext': game.select(game.stageIdx + 1, game.carIdx); game.toMenu(); break;
      case 'carPrev': game.select(game.stageIdx, game.carIdx - 1); break;
      case 'carNext': game.select(game.stageIdx, game.carIdx + 1); break;
      case 'trans': game.auto = !game.auto; break;
      case 'start':
      case 'retry': startRace(); return;
      case 'menu': game.toMenu(); setEngine(0, false, false); show('menu'); break;
    }
    refreshMenu();
  }),
);

$('mute').addEventListener('click', () => {
  initAudio();
  $('mute').classList.toggle('off', toggleMute());
});

setupInput();
window.addEventListener('resize', resize);
resize();
game.select(0, 0);
game.toMenu();
refreshMenu();
show('menu');

// laço principal com passo fixo de física (60 Hz)
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
function frame(now: number) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  render(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// expõe para testes automatizados
Object.assign(window, { game, input });
