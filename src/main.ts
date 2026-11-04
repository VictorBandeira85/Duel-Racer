import { VOLS, prefs, savePrefs } from './prefs';
import { clearArcade, loadArcade, saveArcade } from './arcadesave';
import { capsHtml } from './ui';
import { stageResult } from './score';
import '@fontsource/press-start-2p/400.css';
import { RES, setRes, view } from './config';
import { CARS, TRAFFIC_IMAGES } from './cars';
import { COURSES, completeCourse, unlockedCourses, withTimeOfDay, type ArcadeTime, type Course } from './courses';
import { ui as careerUi } from './careerScreens';
import { setupOf, REGIONS, carById, eventCourse, levels, loadCareer, saveCareer, settleEvent, tunedCar } from './career';
import type { CarSpec } from './cars';
import { Race } from './race';
import { ghostOn, loadGhost, saveRun, setGhostOn } from './records';
import { CHALLENGE_PRIZE, checkChallenge, partialStats, saveMedal, stageAchievements, stageChallenges, toast } from './challenges';
import { paintHex } from './paint';
import { preloadCockpit, renderCockpit } from './cockpit';
import { applyBtnSize, beginLoading, btnSizeLabel, cycleBtnSize, drawScreen, drawToast, keyScreen, saveScore, tapScreen, type Actions, type AppState, type MenuKey, type ScreenId } from './screens';
import { binding, input, pollGamepad, releaseAll, setBind, setupInput, touch } from './input';
import { MUSIC_CREDITS } from './tracks';
import { audioCtx, audioState, resumeAudio, sfxLevel, synthReady, setSfxVolume, initAudio, musicTitle, suspendAudio, playMusic, setEngine, setMusicOn, setMusicVolume, setMuted, setSiren, setTires } from './audio';
import { stopTrafficAudio } from './trafficaudio';
import { preloadSvg } from './svgsprites';
import { FX_LABEL, fxMode, lowFx, perfSample, setFxMode, lowRes } from './perf';
import { F40_REAR, F40_SIDE, F40_WHEEL } from './svg/f40';

preloadSvg(F40_SIDE, F40_REAR, F40_WHEEL, ...CARS.flatMap((c) => [c.imgSide, c.sideMask, c.rear.img, c.rear.imgMask, c.rear.frontImg, c.rear.frontMask]).filter((s): s is string => !!s), ...TRAFFIC_IMAGES);
import { preloadPhotos } from './photos';
preloadPhotos();

const canvas = document.getElementById('game') as HTMLCanvasElement;
// opaco: a página não precisa misturar o jogo com o fundo (mais leve para a placa de vídeo)
const ctx = canvas.getContext('2d', { alpha: false })!;
const $ = (id: string) => document.getElementById(id)!;
$('credits').textContent = MUSIC_CREDITS;
setMuted(!prefs.sound);
setMusicOn(prefs.music);
$('version').textContent = __APP_VERSION__;

const state: AppState = {
  screen: 'title', t: 0, sel: 0, auto: prefs.auto, sound: prefs.sound, music: prefs.music,
  carIdx: 0, oppIdx: 0, courseIdx: 0, scoreCourse: 0,
  lives: 5, results: [], gameOver: false,
  mode: 'arcade', career: loadCareer(), careerResult: null, gasPage: 0, arcadeTime: 'day', courseTop: 0, newMap: null, lockedT: 0, carFilter: null, oppFilter: null,
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
    state.sel = s === 'title' ? 0 : s === 'course' ? unlockedCourses() - 1 : 0; // percursos: já no mapa liberado mais novo
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
      course: withTimeOfDay(COURSES[state.courseIdx], state.arcadeTime), car: CARS[state.carIdx],
      rival: state.oppIdx < CARS.length ? CARS[state.oppIdx] : null, opts: {},
    };
    begin(5);
  },
  // continua o roteiro do Arcade de onde parou (trechos feitos e carros restantes), com o carro
  // e o rival escolhidos agora (pode trocar de carro no meio do roteiro)
  resumeCourse() {
    const sv = loadArcade();
    if (!sv) return;
    Object.assign(state, { courseIdx: sv.courseIdx, arcadeTime: (sv.time as ArcadeTime | undefined) ?? (sv.night ? 'night' : 'day') });
    state.mode = 'arcade';
    run = {
      course: withTimeOfDay(COURSES[sv.courseIdx], state.arcadeTime), car: CARS[state.carIdx],
      rival: state.oppIdx < CARS.length ? CARS[state.oppIdx] : null, opts: {},
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
  // volumes: 25% → 50% → 75% → 100% → 25%... (música e efeitos separados)
  cycleMusicVol() {
    savePrefs({ musVol: (prefs.musVol + 1) % VOLS.length });
    setMusicVolume(VOLS[prefs.musVol]);
  },
  cycleSfxVol() {
    savePrefs({ sfxVol: (prefs.sfxVol + 1) % VOLS.length });
    setSfxVolume(VOLS[prefs.sfxVol]);
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

// antes de cada trecho: página de carregamento (foto e dica) enquanto a cabine e a pista se preparam
function startStage(i: number) {
  preloadCockpit(run.car.dash);
  showControls(false);
  beginLoading(state, () => startStageNow(i));
}
function startStageNow(i: number) {
  // rival à frente no 1º trecho; depois, quem chegou primeiro ao posto no trecho anterior
  // larga atrás e o outro à frente (vale no Arcade e na Carreira)
  const prev = i > 0 ? state.results[i - 1] : undefined;
  const rivalAhead = !prev || !(prev.rival < 0 || prev.time <= prev.rival);
  const r = new Race(run.course, i, run.car, run.rival, state.auto, { ...run.opts, rivalAhead });
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
      saveArcade({ course: run.course.id, courseIdx: state.courseIdx, carIdx: state.carIdx, oppIdx: state.oppIdx, night: state.arcadeTime === 'night', time: state.arcadeTime, lives: state.lives, results: state.results });
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
    `Pista: ${st?.theme ?? '-'}${st?.night ? ' · noite' : ''}${st?.dusk ? ' · pôr do sol' : ''}${st?.tod ? ` · ${st.tod === 'dawn' ? 'amanhecer' : 'entardecer'}` : ''}${st?.weather ? ` · ${st.weather}` : ''} · ${race ? Math.round((race.playerZ / race.track.finishZ) * 100) : 0}% do trecho`,
    `Gráficos: ${FX_LABEL[fxMode()]}${lowFx() ? ' (econômico ativo)' : ''} · FPS médio ${fpsAvg} (mín ${fpsMin})`,
    `Tela: ${window.innerWidth}x${window.innerHeight} · densidade ${window.devicePixelRatio} · resolução interna ${RES}x`,
    `Áudio: ${audioState()} · motor ${synthReady() ? 'sintetizado' : 'simples'} · nível ${sfxLevel().toFixed(3)} · efeitos ${state.sound ? 'ligados' : 'desligados'} ${VOLS[prefs.sfxVol] * 100}%`,
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
  $('qSound').innerHTML = capsHtml(`EFEITOS: ${state.sound ? 'LIGADOS' : 'DESLIGADOS'}`);
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
setMusicVolume(VOLS[prefs.musVol]);
setSfxVolume(VOLS[prefs.sfxVol]);
function settingsLabels() {
  const lab: Record<string, [string, string]> = {
    sound: ['EFEITOS', state.sound ? 'LIGADOS' : 'DESLIGADOS'],
    music: ['MÚSICA', state.music ? 'LIGADA' : 'DESLIGADA'],
    volume: ['VOL. MÚSICA', `${VOLS[prefs.musVol] * 100}%`],
    sfxvol: ['VOL. EFEITOS', `${VOLS[prefs.sfxVol] * 100}%`],
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
      actions.cycleMusicVol();
      break;
    case 'sfxvol': actions.cycleSfxVol(); break;
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
// áudio suspenso pelo sistema (tela bloqueada, outro app, iPhone em segundo plano): volta no
// primeiro toque ou tecla e, onde o navegador deixa, sozinho a cada segundo durante a corrida
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, resumeAudio, { capture: true, passive: true });
let audioCheck = 0;
function frame(now: number) {
  if (now - audioCheck > 1000 && !document.hidden) {
    audioCheck = now;
    if (audioState() !== 'running' && audioState() !== 'none') resumeAudio();
  }
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
  // na largada o quadro de desafios ocupa o alto do para-brisa: o aviso aparece logo abaixo dele
  const chBox = state.screen === 'race' && race && race.challenges.length && (race.state === 'countdown' || (race.state === 'drive' && race.time < 5));
  // na tela do posto o aviso fica abaixo da placa POSTO DUELO
  drawToast(ctx, dt, chBox ? 38 + race!.challenges.length * 6 : state.screen === 'gas' && !state.gasPage ? 44 : 0);
}
// abertura: página de carregamento enquanto as artes dos carros chegam, depois a capa
beginLoading(state, () => actions.go('title'), 1.4);
requestAnimationFrame(frame);

// para testes automatizados
Object.assign(window, { app: { state, actions, beginLoading, courses: COURSES, cars: CARS, get race() { return race; } }, input, audio: { audioCtx, synthReady, sfxLevel } });

// app instalável: funciona sem internet (não no arquivo único usado para testes)
if ('serviceWorker' in navigator && import.meta.env.MODE !== 'single' && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
applyBtnSize(); // tamanho dos botões escolhido nas opções
