import { prefs, savePrefs } from './prefs';
import { clearArcade, loadArcade, saveArcade } from './arcadesave';
import { capsHtml } from './ui';
import { stageResult } from './score';
import '@fontsource/press-start-2p/400.css';
import { RES, setRes, view } from './config';
import { CARS, TRAFFIC_IMAGES } from './cars';
import { COURSES, completeCourse, unlockedCourses, withTimeOfDay, type Course } from './courses';
import { ui as careerUi } from './careerScreens';
import { setupOf, REGIONS, carById, eventCourse, levels, loadCareer, saveCareer, settleEvent, tunedCar } from './career';
import type { CarSpec } from './cars';
import { Race } from './race';
import { ghostOn, loadGhost, saveRun, setGhostOn } from './records';
import { CHALLENGE_PRIZE, checkChallenge, partialStats, saveMedal, stageAchievements, stageChallenges, toast } from './challenges';
import { paintHex } from './paint';
import { preloadCockpit, renderCockpit } from './cockpit';
import { applyBtnSize, btnSizeLabel, cycleBtnSize, drawScreen, drawToast, keyScreen, saveScore, tapScreen, type Actions, type AppState, type MenuKey, type ScreenId } from './screens';
import { binding, input, pollGamepad, releaseAll, setBind, setupInput, touch } from './input';
import { MUSIC_CREDITS } from './tracks';
import { initAudio, musicTitle, suspendAudio, playMusic, setEngine, setMusicOn, setMusicVolume, setMuted, setSiren, setTires } from './audio';
import { stopTrafficAudio } from './trafficaudio';
import { preloadSvg } from './svgsprites';
import { FX_LABEL, fxMode, lowFx, perfSample, setFxMode, lowRes } from './perf';
import { F40_REAR, F40_SIDE, F40_WHEEL } from './svg/f40';

preloadSvg(F40_SIDE, F40_REAR, F40_WHEEL, ...CARS.flatMap((c) => [c.imgSide, c.sideMask, c.rear.img, c.rear.imgMask, c.rear.frontImg, c.rear.frontMask]).filter((s): s is string => !!s), ...TRAFFIC_IMAGES);

const canvas = document.getElementById('game') as HTMLCanvasElement;
// opaco: a página não precisa misturar o jogo com o fundo (mais leve para a placa de vídeo)
const ctx = canvas.getContext('2d', { alpha: false })!;
const $ = (id: string) => document.getElementById(id)!;
$('credits').textContent = MUSIC_CREDITS;
setMuted(!prefs.sound);
setMusicOn(prefs.music);
$('version').textContent = __APP_VERSION__;

const state: AppState = {
  screen: 'title', t: 0, sel: 1, auto: prefs.auto, sound: prefs.sound, music: prefs.music,
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

// botões de toque só onde há tela de toque (no computador joga-se no teclado ou no controle);
// se alguém tocar a tela depois (notebook com tela touch), eles passam a aparecer
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !touch.ui) {
    touch.ui = true;
    if (state.screen === 'race') $('controls').classList.remove('hidden');
  }
}, { capture: true });

function showControls(on: boolean) {
  $('controls').classList.toggle('hidden', !on || !touch.ui);
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
    $('settings').classList.add('hidden'); // ajustes da pausa não ficam abertos sobre o menu
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
  // continua o roteiro do Arcade de onde parou (trechos feitos e carros restantes)
  resumeCourse() {
    const sv = loadArcade();
    if (!sv) return;
    Object.assign(state, { courseIdx: sv.courseIdx, carIdx: sv.carIdx, oppIdx: sv.oppIdx, arcadeNight: sv.night });
    state.mode = 'arcade';
    run = {
      course: withTimeOfDay(COURSES[sv.courseIdx], sv.night), car: CARS[sv.carIdx],
      rival: sv.oppIdx < CARS.length ? CARS[sv.oppIdx] : null, opts: {},
    };
    initAudio();
    state.lives = sv.lives;
    state.results = sv.results;
    state.gameOver = false;
    state.newMap = null;
    if (state.results.length >= run.course.stages.length) finishCourse();
    else startStage(state.results.length);
  },
  startEvent(region: number, event: number) {
    const cs = state.career!;
    const ev = REGIONS[region].events[event];
    careerUi.region = region;
    careerUi.event = event;
    state.mode = 'career';
    state.carIdx = CARS.findIndex((c) => c.id === cs.car);
    run = {
      course: eventCourse(ev, cs.races), car: tunedCar(carById(cs.car), levels(cs, cs.car), setupOf(cs, cs.car)), rival: carById(ev.driver.car),
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
    savePrefs({ sound: state.sound });
  },
  toggleMusic() {
    state.music = !state.music;
    setMusicOn(state.music);
    savePrefs({ music: state.music });
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
  r.ghostRun = loadGhost(run.course.id, i, true);
  r.showGhost = ghostOn();
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
    if (state.mode === 'arcade') {
      saveArcade({ course: run.course.id, courseIdx: state.courseIdx, carIdx: state.carIdx, oppIdx: state.oppIdx, night: state.arcadeNight, lives: state.lives, results: state.results });
    }
    state.gasPage = 0;
    state.gasNight = !!r.def.night && !r.def.dusk;
    actions.go('gas');
  };
  r.onCrash = () => {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      if (state.mode === 'career') settle(false, r);
      else {
        clearArcade(); // sem carros: o roteiro acabou
        actions.go('end');
      }
    }
  };
  race = r;
  releaseAll();
  state.screen = 'race';
  resize();
  showControls(true);
  // uma faixa por trecho (muda a cada trecho e a cada percurso)
  playMusic(`race:${(run.event ? run.event.region * 3 + run.event.event : state.courseIdx * 5) + i}`);
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
  clearArcade();
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
  const scale = Math.min(availW / (view.w * view.aspect), availH / view.h);
  // resolução de desenho: acompanha os pixels reais da tela (pista, carros e objetos mais
  // definidos); no econômico fica em 2
  const dev = scale * (window.devicePixelRatio || 1);
  // (no MÁXIMO usa 4 também em monitores comuns de computador: carros e cenário bem definidos;
  // no automático só em telas densas, e se o aparelho não der conta volta para 2 sozinho)
  setRes(!lowFx() && !lowRes() && dev >= (fxMode() === 'alto' ? 1.4 : 3.5) ? 4 : 2);
  canvas.width = view.w * RES;
  canvas.height = view.h * RES;
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.imageSmoothingEnabled = false;
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
// tela cheia: F11 ou Alt+Enter (no navegador e na versão de computador)
window.addEventListener('keydown', (e) => {
  if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
});
window.addEventListener('keydown', (e) => {
  // tela CONTROLES esperando a tecla nova: Esc cancela, qualquer outra vira a tecla da ação
  if (binding.action) {
    e.preventDefault();
    if (e.code !== 'Escape' && !MENU_KEYS[e.code]?.match(/^(ok)$/)) setBind(binding.action, e.code);
    binding.action = null;
    return;
  }
  const k = MENU_KEYS[e.code];
  // janela "Sair do jogo?" aberta: setas escolhem, Enter confirma, Esc fecha
  if (quitOpen()) {
    if (k) {
      e.preventDefault();
      panelKey(k);
    }
    return;
  }
  if (state.screen === 'race') {
    if (paused && k) {
      e.preventDefault();
      panelKey(k);
    } else if (e.code === 'Escape') setPaused(true);
    return;
  }
  if (k) {
    initAudio();
    // Esc na capa: pergunta se quer sair para a área de trabalho (só no programa de computador)
    if (k === 'back' && state.screen === 'title' && DESKTOP) return openQuit();
    keyScreen(state, actions, k);
  }
});

// ---- painéis em HTML (pausa, ajustes, sair) pelo teclado e pelo controle ----
const DESKTOP = /electron/i.test(navigator.userAgent);
let focusIdx = 0;
function panelButtons(): HTMLButtonElement[] {
  const root = quitOpen() ? $('quitDlg') : !$('settings').classList.contains('hidden') ? $('settings') : $('pause');
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.offsetParent !== null);
}
function showFocus() {
  const bs = panelButtons();
  document.querySelectorAll('.kfocus').forEach((el) => el.classList.remove('kfocus'));
  if (!bs.length) return;
  focusIdx = ((focusIdx % bs.length) + bs.length) % bs.length;
  bs[focusIdx].classList.add('kfocus');
}
function panelKey(k: MenuKey) {
  const bs = panelButtons();
  if (k === 'up' || k === 'left') focusIdx--;
  else if (k === 'down' || k === 'right') focusIdx++;
  else if (k === 'ok') {
    // continua no mesmo botão (ligar/desligar música); trocou de painel, começa do primeiro
    const before = panelButtons()[0];
    bs[((focusIdx % bs.length) + bs.length) % bs.length]?.click();
    if (panelButtons()[0] !== before) focusIdx = 0;
  } else if (k === 'back') {
    if (quitOpen()) closeQuit();
    else if (!$('settings').classList.contains('hidden')) $('setBack').click();
    else setPaused(false);
    focusIdx = 0;
  }
  showFocus();
}
const quitOpen = () => !$('quitDlg').classList.contains('hidden');
function openQuit() {
  $('quitDlg').classList.remove('hidden');
  focusIdx = 1; // começa no NÃO
  showFocus();
}
function closeQuit() {
  $('quitDlg').classList.add('hidden');
}
type DeskApi = { minimize: () => void; quit: () => void };
const desk = (window as unknown as { desktop?: DeskApi }).desktop;
$('quitYes').addEventListener('click', () => (desk ? desk.quit() : window.close()));
// minimizar a janela (só no programa de computador): na corrida, fica pausada
const minimize = () => {
  if (state.screen === 'race' && !paused) setPaused(true);
  closeQuit();
  desk?.minimize();
};
$('quitMin').addEventListener('click', minimize);
$('pauseMin').addEventListener('click', minimize);
document.body.classList.toggle('desktop', DESKTOP);

// relatório de problema (pausa): junta versão, aparelho, carro, roteiro e desempenho num texto e
// copia para colar no grupo de teste
function reportText() {
  const st = race?.def;
  const fpsAvg = fpsHist.length ? Math.round(fpsHist.reduce((a, b) => a + b, 0) / fpsHist.length) : 0;
  const fpsMin = fpsHist.length ? Math.min(...fpsHist) : 0;
  const ua = navigator.userAgent;
  const sys = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? (touch.ui ? 'iPad' : 'Mac') : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'outro';
  return [
    'DUEL RACER - RELATÓRIO DE PROBLEMA',
    `Versão: ${__APP_VERSION__} (${DESKTOP ? 'programa de PC' : 'navegador'}, ${sys})`,
    `Modo: ${state.mode === 'career' ? 'Carreira' : 'Arcade'} · Roteiro: ${state.mode === 'career' ? '-' : COURSES[state.courseIdx]?.name} · Trecho ${(race?.stageIdx ?? 0) + 1}`,
    `Carro: ${run.car.name} · Rival: ${run.rival?.name ?? '-'}`,
    `Pista: ${st?.theme ?? '-'}${st?.night ? ' · noite' : ''}${st?.dusk ? ' · pôr do sol' : ''}${st?.weather ? ` · ${st.weather}` : ''} · ${race ? Math.round((race.playerZ / race.track.finishZ) * 100) : 0}% do trecho`,
    `Gráficos: ${FX_LABEL[fxMode()]}${lowFx() ? ' (econômico ativo)' : ''} · FPS médio ${fpsAvg} (mín ${fpsMin})`,
    `Tela: ${window.innerWidth}x${window.innerHeight} · densidade ${window.devicePixelRatio} · resolução interna ${RES}x`,
    'O que aconteceu: ',
  ].join('\n');
}
$('report').addEventListener('click', async () => {
  const t = reportText();
  let ok = false;
  try {
    await navigator.clipboard.writeText(t);
    ok = true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
  }
  $('report').textContent = ok ? 'COPIADO! COLE NO GRUPO' : 'NÃO FOI POSSÍVEL COPIAR';
  setTimeout(() => ($('report').textContent = 'REPORTAR PROBLEMA'), 2500);
});
$('quitNo').addEventListener('click', closeQuit);

function setPaused(p: boolean) {
  paused = p;
  $('pause').classList.toggle('hidden', !p);
  $('settings').classList.add('hidden');
  focusIdx = 0;
  if (p) setTimeout(showFocus);
  quickLabels();
  $('nowPlaying').textContent = musicTitle() ? `♪ ${musicTitle()}` : '';
  // ajustes abertos no menu principal ficam fechados ao entrar/sair da pausa
  if (p) {
    setEngine(0, false, false);
    stopTrafficAudio();
    setSiren(false);
    releaseAll();
  }
}
// pausa no toque (pointerdown): o click do iOS se perde se o dedo mexer um pouco
$('pauseBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  setPaused(true);
});
// atalhos da pausa: música e efeitos sonoros sem abrir os ajustes
function quickLabels() {
  $('qMusic').innerHTML = capsHtml(`MÚSICA: ${state.music ? 'LIGADA' : 'DESLIGADA'}`);
  $('qSound').innerHTML = capsHtml(`SONS: ${state.sound ? 'LIGADOS' : 'DESLIGADOS'}`);
  $('qMusic').classList.toggle('off', !state.music);
  $('qSound').classList.toggle('off', !state.sound);
}
$('qMusic').addEventListener('click', () => {
  actions.toggleMusic();
  quickLabels();
});
$('qSound').addEventListener('click', () => {
  actions.toggleSound();
  quickLabels();
});
$('resume').addEventListener('click', () => setPaused(false));
$('quit').addEventListener('click', () => {
  // o que foi feito no trecho interrompido (ultrapassagens, túneis) entra nas estatísticas
  if (race) partialStats(race);
  actions.go('title');
});
// recomeça o trecho atual do zero (as vidas e os trechos já feitos continuam)
$('restart').addEventListener('click', () => {
  if (race) startStage(race.stageIdx);
});
// ajustes durante a corrida (os mesmos do menu principal, e mais o volume e a faixa)
const VOLS = [0.25, 0.5, 0.75, 1];
let volIdx = 3;
try { volIdx = Math.max(0, Math.min(3, Number(localStorage.getItem('duel-racer:volume-musica') ?? 3))); } catch { /* sem armazenamento */ }
setMusicVolume(VOLS[volIdx]);
function settingsLabels() {
  const lab: Record<string, [string, string]> = {
    sound: ['SOM', state.sound ? 'LIGADO' : 'DESLIGADO'],
    music: ['MÚSICA', state.music ? 'LIGADA' : 'DESLIGADA'],
    volume: ['VOLUME', `${VOLS[volIdx] * 100}%`],
    track: ['FAIXA ▶', musicTitle() || '-'],
    gear: ['CÂMBIO', state.auto ? 'AUTOMÁTICO' : 'MANUAL'],
    buttons: ['BOTÕES', btnSizeLabel()],
    ghost: ['FANTASMA', ghostOn() ? 'LIGADO' : 'DESLIGADO'],
    hints: ['DICAS', prefs.hints ? 'LIGADAS' : 'DESLIGADAS'],
    fps: ['MOSTRAR FPS', prefs.fps ? 'SIM' : 'NÃO'],
    fps30: ['QUADROS', prefs.fps30 ? '30 FPS' : '60 FPS'],
    fx: ['GRÁFICOS', FX_LABEL[fxMode()] + (fxMode() === 'auto' && lowFx() ? ' (ECO)' : '')],
  };
  document.querySelectorAll<HTMLButtonElement>('#settings [data-set]').forEach((b) => {
    const [k, v] = lab[b.dataset.set!];
    b.innerHTML = `${capsHtml(k)}<span>${capsHtml(v)}</span>`;
  });
}
let trackStep = 0;
document.querySelectorAll<HTMLButtonElement>('#settings [data-set]').forEach((b) => b.addEventListener('click', () => {
  switch (b.dataset.set) {
    case 'sound': actions.toggleSound(); break;
    case 'music': actions.toggleMusic(); break;
    case 'volume':
      volIdx = (volIdx + 1) % VOLS.length;
      setMusicVolume(VOLS[volIdx]);
      try { localStorage.setItem('duel-racer:volume-musica', String(volIdx)); } catch { /* sem armazenamento */ }
      break;
    case 'track': playMusic(`race:${state.courseIdx * 5 + (race?.stageIdx ?? 0) + ++trackStep}`); break;
    case 'gear':
      state.auto = !state.auto;
      savePrefs({ auto: state.auto });
      if (race) race.auto = state.auto;
      $('gearBtns').classList.toggle('hidden', state.auto);
      break;
    case 'buttons': cycleBtnSize(); break;
    case 'ghost':
      setGhostOn(!ghostOn());
      if (race) race.showGhost = ghostOn();
      break;
    case 'hints': savePrefs({ hints: !prefs.hints }); break;
    case 'fps': savePrefs({ fps: !prefs.fps }); break;
    case 'fps30': savePrefs({ fps30: !prefs.fps30 }); break;
    case 'fx': setFxMode(({ auto: 'alto', alto: 'eco', eco: 'auto' } as const)[fxMode()]); resize(); break;
  }
  settingsLabels();
}));
$('setBtn').addEventListener('click', () => {
  settingsLabels();
  $('settings').classList.remove('hidden');
  $('pause').classList.add('hidden');
});
$('setBack').addEventListener('click', () => {
  $('settings').classList.add('hidden');
  $('pause').classList.remove('hidden');
  quickLabels();
  $('nowPlaying').textContent = musicTitle() ? `♪ ${musicTitle()}` : '';
});

// aplicativo em segundo plano (trocou de app, bloqueou a tela): a corrida pausa e o som para;
// ao voltar o som retoma e a corrida espera o jogador tocar em CONTINUAR
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'race' && !paused) setPaused(true);
  suspendAudio(document.hidden);
});

setupInput();
window.addEventListener('resize', resize);
resize();

// laço principal com física em passo fixo (60 Hz)
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
// contador de quadros por segundo no canto de cima à esquerda (opção MOSTRAR FPS)
const fpsEl = document.getElementById('fps')!;
let fpsN = 0, fpsT0 = 0;
let fpsHist: number[] = []; // médias dos últimos ~10 s (para o relatório de problema)
function countFps(now: number) {
  fpsEl.classList.toggle('hidden', !prefs.fps);
  fpsEl.classList.toggle('race', state.screen === 'race');
  fpsN++;
  if (now - fpsT0 >= 500) {
    const v = Math.round((fpsN * 1000) / (now - fpsT0));
    if (state.screen === 'race' && !paused) fpsHist = [...fpsHist.slice(-19), v];
    fpsEl.textContent = `${v} FPS`;
    fpsEl.classList.toggle('low', v < (prefs.fps30 ? 28 : 55));
    fpsN = 0;
    fpsT0 = now;
  }
}

// opção QUADROS 30 FPS: desenha um quadro a cada ~33 ms (em telas de 60 Hz, um sim e um
// não); a física continua no passo fixo de 60 Hz, então o carro anda igual, só com menos
// quadros desenhados (como no iPhone em modo de economia)
let nextDraw = 0;
function frame(now: number) {
  if (prefs.fps30) {
    const gap = 1000 / 30;
    if (now < nextDraw - 3) {
      requestAnimationFrame(frame);
      return;
    }
    nextDraw = now - nextDraw > gap ? now + gap : nextDraw + gap;
  }
  countFps(now);
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
let lastLow = false, lastRes = false;
const gearEl = document.getElementById('gearNum')!;
function frameInner(now: number) {
  const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); // o primeiro quadro pode vir antes de `last`
  last = now;
  state.t += dt;
  // controle Bluetooth: na corrida mexe direto nos comandos; nos menus vira navegação
  for (const k of pollGamepad()) {
    if (quitOpen()) panelKey(k === 'start' ? 'ok' : k);
    else if (state.screen === 'race') {
      if (k === 'start') setPaused(!paused);
      else if (paused) panelKey(k);
    } else if (k === 'back' && state.screen === 'title' && DESKTOP) openQuit();
    else if (k !== 'start') {
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
    // câmbio manual: a marcha engatada entre os botões (N parado, R não existe no jogo)
    if (!state.auto) {
      const g = race.speed < 1 && !race.throttle ? 'N' : String(race.gear + 1);
      if (gearEl.textContent !== g) gearEl.textContent = g;
    }
    if (state.screen === 'race') {
      // a 30 FPS o tempo de quadro é avaliado pela metade: só baixa os gráficos se nem 30 segurar
      if (!paused) perfSample(prefs.fps30 ? dt / 2 : dt);
      // o econômico (escolhido ou automático) também baixa a resolução de desenho para 2x
      if (lowFx() !== lastLow || lowRes() !== lastRes) {
        lastLow = lowFx();
        lastRes = lowRes();
        resize();
      }
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
