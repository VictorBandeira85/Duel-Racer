import { preloadScenery } from './sprites';
import { preloadBgArt } from './bgart';
import { carSwapWatch } from './carswap';
import { freeBudget, newFrame } from './svgsprites';
import { VIEW_LEVELS, prefs, raceViewSize, savePrefs, volLabel } from './prefs';
import { clearArcade, loadArcade, saveArcade } from './arcadesave';
import { capsHtml } from './ui';
import { stageResult } from './score';
import '@fontsource/press-start-2p/400.css';
import { CRES, RES, setCanvasRes, setRes, view } from './config';
import { CARS, TRAFFIC_IMAGES } from './cars';
import { COURSES, completeCourse, unlockedCourses, withTimeOfDay, type ArcadeTime, type Course } from './courses';
import { ui as careerUi } from './careerScreens';
import { setupOf, buildOf, REGIONS, carById, eventCourse, levels, loadCareer, saveCareer, settleEvent, tunedCar } from './career';
import type { CarSpec } from './cars';
import { Race } from './race';
import { ghostOn, loadGhost, saveRun, setGhostOn } from './records';
import { CHALLENGE_PRIZE, checkChallenge, partialStats, saveMedal, stageAchievements, stageChallenges, toast } from './challenges';
import { paintHex } from './paint';
import { VIEW_EXTRA_CAP, cockpitReady, preloadCockpit, renderCockpit } from './cockpit';
import { applyBtnSize, beginLoading, btnSizeLabel, cycleBtnSize, drawScreen, drawToast, focusInfo, hoverScreen, keyScreen, setScreenActions, saveScore, tapScreen, type Actions, type AppState, type MenuKey, type ScreenId } from './screens';
import { binding, binds, input, lastDevice, pad, pollGamepad, releaseAll, setBind, setupInput, touch } from './input';
import { MUSIC_CREDITS } from './tracks';
import { audioCtx, audioState, gainLevels, resumeAudio, sfxLevel, synthReady, setSfxVolume, initAudio, musicTitle, suspendAudio, playMusic, setEngine, setMusicVolume, setSiren, setTires } from './audio';
import { stopTrafficAudio } from './trafficaudio';
import { preloadSvg } from './svgsprites';
import { FX_LABEL, fxMode, lowFx, perfSample, setFxMode, lowRes } from './perf';
import { F40_REAR, F40_SIDE, F40_WHEEL } from './svg/f40';

preloadSvg(F40_SIDE, F40_REAR, F40_WHEEL, ...CARS.flatMap((c) => [c.imgSide, c.sideMask, c.rear.img, c.rear.imgMask, c.rear.frontImg, c.rear.frontMask]).filter((s): s is string => !!s), ...TRAFFIC_IMAGES);
import { preloadPhotos } from './photos';
preloadPhotos();
preloadScenery();
preloadBgArt(); // fundos desenhados (relevo do horizonte): prontos antes da primeira corrida

const canvas = document.getElementById('game') as HTMLCanvasElement;
// opaco: a página não precisa misturar o jogo com o fundo (mais leve para a placa de vídeo)
const ctx = canvas.getContext('2d', { alpha: false })!;
const $ = (id: string) => document.getElementById(id)!;
$('credits').textContent = MUSIC_CREDITS;
$('version').textContent = __APP_VERSION__;

const state: AppState = {
  screen: 'title', t: 0, sel: 0, auto: prefs.auto,
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

// Arcade: o carro que o jogador tem na garagem da carreira entra com as peças e ajustes da oficina
function arcadeCar() {
  const car = CARS[state.carIdx], cs = state.career;
  if (!cs || !cs.owned.includes(car.id)) return car;
  return tunedCar(car, levels(cs, car.id), setupOf(cs, car.id), buildOf(cs, car.id));
}
const actions: Actions = {
  go(s: ScreenId) {
    binding.action = null; // saiu da tela CONTROLES no meio da troca de tecla: cancela
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
      course: withTimeOfDay(COURSES[state.courseIdx], state.arcadeTime), car: arcadeCar(),
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
      course: withTimeOfDay(COURSES[sv.courseIdx], state.arcadeTime), car: arcadeCar(),
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
      course: eventCourse(ev, cs.races), car: tunedCar(carById(cs.car), levels(cs, cs.car), setupOf(cs, cs.car), buildOf(cs, cs.car)), rival: carById(ev.driver.car),
      opts: { rivalStyle: ev.driver.style, rivalPaint: ev.driver.paint }, event: { region, event },
    };
    begin(4);
  },
  nextStage() {
    if (state.results.length >= run.course.stages.length) finishCourse();
    else startStage(state.results.length);
  },
  // volumes da música e dos efeitos (0 = mudo, até 100%, de 10 em 10), separados
  // music: música das corridas; menu: música dos menus (volumes separados)
  setVolume(kind: 'sfx' | 'music' | 'menu', pct: number) {
    const v = Math.max(0, Math.min(100, Math.round(pct / 10) * 10));
    if (kind === 'sfx') {
      savePrefs({ sfxPct: v });
      setSfxVolume(v / 100);
    } else if (kind === 'menu') {
      savePrefs({ menuPct: v });
      setMusicVolume(prefs.menuPct / 100, prefs.musPct / 100);
    } else {
      savePrefs({ musPct: v, musSet: true });
      setMusicVolume(prefs.menuPct / 100, prefs.musPct / 100);
    }
  },
};

setScreenActions(actions);

function begin(lives: number) {
  initAudio();
  state.playerCar = run.car; // posto e fim mostram o carro preparado (altura, rodas, cor)
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
  warm = null;
  beginLoading(state, () => startStageNow(i), undefined, () => cockpitReady(run.car.dash) && warmUp(i));
}
// Aquecimento: com a cabine carregada, a corrida já é montada e os primeiros quadros são desenhados
// fora da tela (cenário, carros, névoa, luzes da noite e retrovisor ficam prontos). Sem isso o 3º
// quadro da corrida travava meio segundo nos aparelhos mais lentos.
let warm: { i: number; r: Race; n: number } | null = null;
const WARM_FRAMES = 3;
let warmCv: HTMLCanvasElement | null = null;
function warmUp(i: number) {
  if (!warm || warm.i !== i) {
    warm = { i, r: makeRace(i), n: 0 };
    return false;
  }
  if (warm.n >= WARM_FRAMES) return true;
  const saved = { w: view.w, h: view.h, aspect: view.aspect };
  try {
    // as medidas da tela de corrida (as mesmas do resize), num canvas à parte
    const safe = getComputedStyle(safeProbe);
    const px = (v: string) => parseFloat(v) || 0;
    const aw = window.innerWidth - px(safe.paddingLeft) - px(safe.paddingRight), ah = window.innerHeight - px(safe.paddingTop) - px(safe.paddingBottom);
    const rv = raceViewSize(aw / ah, VIEW_EXTRA_CAP[run.car.dash] ?? 96);
    view.h = rv.h;
    view.aspect = 8 / 7;
    view.w = rv.w;
    if (!warmCv) warmCv = document.createElement('canvas');
    warmCv.width = view.w * CRES;
    warmCv.height = view.h * CRES;
    const g = warmCv.getContext('2d')!;
    g.setTransform(CRES, 0, 0, CRES, 0, 0);
    g.imageSmoothingEnabled = false;
    freeBudget();
    renderCockpit(g, warm.r, state.lives, `${i + 1}/${run.course.stages.length}`, totalTime(), 0);
  } catch {
    warm.n = WARM_FRAMES; // aquecimento é só ganho: se algo falhar, a corrida segue normal
  } finally {
    Object.assign(view, saved);
  }
  warm.n++;
  return warm.n >= WARM_FRAMES;
}
function startStageNow(i: number) {
  const r = warm?.i === i ? warm.r : makeRace(i);
  warm = null;
  race = r;
  releaseAll();
  state.screen = 'race';
  resize();
  showControls(true);
  // uma faixa por trecho (muda a cada trecho e a cada percurso)
  playMusic(`race:${(run.event ? run.event.region * 3 + run.event.event : state.courseIdx * 5) + i}`);
}
function makeRace(i: number) {
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
  return r;
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
  // VISÃO DO PAINEL afastada: tela de corrida mais alta (e mais larga) que as 224 linhas
  if (race) Object.assign(view, raceViewSize(screenAspect, VIEW_EXTRA_CAP[run.car.dash] ?? 96));
  // resolução interna 2x: tudo continua desenhado em pixels nativos (e ampliado sem
  // suavizar), mas os detalhes finos (números dos mostradores) podem usar meio pixel
  const scale = Math.min(availW / (view.w * view.aspect), availH / view.h);
  // resolução de desenho: acompanha os pixels reais da tela (pista, carros e objetos mais
  // definidos); no econômico fica em 2
  const dev = scale * (window.devicePixelRatio || 1);
  // (no MÁXIMO usa 4 também em monitores comuns de computador: carros e cenário bem definidos;
  // no automático só em telas densas, e se o aparelho não der conta volta para 2 sozinho)
  const dense = dev >= (fxMode() === 'alto' ? 1.4 : 3.5);
  setRes(!lowFx() && !lowRes() && dense ? 4 : 2);
  // a tela continua em 4 (mostradores e menus nítidos); no gráfico baixo só a estrada cai para 2
  setCanvasRes(dense ? 4 : 2);
  canvas.width = view.w * CRES;
  canvas.height = view.h * CRES;
  ctx.setTransform(CRES, 0, 0, CRES, 0, 0);
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

// mouse passando pelos menus: o item embaixo dele fica com o foco (o mesmo destaque das setas);
// sobre um item clicável o cursor vira a mãozinha
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || state.screen === 'race') {
    canvas.style.cursor = '';
    return;
  }
  lastDevice.kind = 'key';
  const rect = canvas.getBoundingClientRect();
  const hit = hoverScreen(state, actions, ((e.clientX - rect.left) / rect.width) * view.w, ((e.clientY - rect.top) / rect.height) * view.h);
  canvas.style.cursor = hit ? 'pointer' : '';
});

const MENU_KEYS: Record<string, MenuKey> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Enter: 'ok', Space: 'ok', Escape: 'back', Backspace: 'back', PageUp: 'prevTab', PageDown: 'nextTab',
};
// nos menus as teclas de marcha (Q/E, ou as escolhidas em CONTROLES) também trocam a classe
const menuKey = (code: string): MenuKey | undefined => MENU_KEYS[code] ?? (code === binds.shiftDown || code === 'KeyZ' ? 'prevTab' : code === binds.shiftUp || code === 'KeyX' ? 'nextTab' : undefined);
// o mesmo comando de menu chegando pelas duas vias ao mesmo tempo (o Steam no PC e a WebView do
// Android também transformam o direcional/A/B do controle em teclas): vale uma vez só
const lastNav: Record<string, { src: 'pad' | 'key'; t: number }> = {};
function dupNav(k: string, src: 'pad' | 'key') {
  const t = performance.now(), l = lastNav[k];
  lastNav[k] = { src, t };
  return !!l && l.src !== src && t - l.t < 150;
}
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
  const k = state.screen === 'race' && !paused ? MENU_KEYS[e.code] : menuKey(e.code);
  if (k && (state.screen !== 'race' || paused || quitOpen()) && dupNav(k, 'key')) {
    e.preventDefault();
    return;
  }
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
// vizinho na direção pedida, pela posição na tela (a grade dos ajustes tem duas colunas: cima e
// baixo andam de linha, esquerda e direita de coluna); sem vizinho, anda na ordem da lista
function panelStep(bs: HTMLButtonElement[], from: number, k: MenuKey) {
  const n = bs.length;
  const cur = bs[((from % n) + n) % n];
  if (!cur) return from;
  const c = cur.getBoundingClientRect();
  const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  const vert = k === 'up' || k === 'down', sign = k === 'up' || k === 'left' ? -1 : 1;
  // candidatos daquele lado; fica a linha (ou coluna) mais próxima e, nela, o mais alinhado
  const cand = bs.map((b, i) => {
    const r = b.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    return { i, along: (vert ? dy : dx) * sign, side: Math.abs(vert ? dx : dy), h: r.height };
  }).filter((q) => bs[q.i] !== cur && q.along >= 4 && (vert || q.side <= Math.max(q.h, c.height) / 2));
  if (cand.length) {
    const near = Math.min(...cand.map((q) => q.along));
    return cand.filter((q) => q.along <= near + 8).sort((p, q) => p.side - q.side + (Math.abs(p.side - q.side) < 6 ? (p.i - q.i) * 1e3 : 0))[0].i;
  }
  // sem vizinho: cima/baixo dão a volta (do último ao primeiro); esquerda/direita andam na lista
  return from + sign;
}
const VOL_SET: Record<string, 'sfx' | 'music'> = { volume: 'music', sfxvol: 'sfx' };
function panelKey(k: MenuKey) {
  const bs = panelButtons();
  const cur = bs[((focusIdx % bs.length) + bs.length) % bs.length];
  const vol = cur && VOL_SET[cur.dataset.set ?? ''];
  if (vol && (k === 'left' || k === 'right')) {
    // nos volumes, esquerda/direita diminuem/aumentam 10%
    actions.setVolume(vol, (vol === 'sfx' ? prefs.sfxPct : prefs.musPct) + (k === 'right' ? 10 : -10));
    settingsLabels();
  } else if (k === 'up' || k === 'down' || k === 'left' || k === 'right') focusIdx = panelStep(bs, focusIdx, k);
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
// mouse sobre um botão da pausa/ajustes/sair: ele fica com o foco (o teclado/controle continua dali)
for (const id of ['pause', 'settings', 'quitDlg']) {
  $(id).addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const b = (e.target as HTMLElement).closest('button');
    const i = b ? panelButtons().indexOf(b as HTMLButtonElement) : -1;
    if (i >= 0) {
      focusIdx = i;
      showFocus();
    }
  });
}
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
    `Tela: ${window.innerWidth}x${window.innerHeight} · densidade ${window.devicePixelRatio} · resolução interna ${RES}x (tela ${CRES}x)`,
    `Áudio: ${audioState()} · motor ${synthReady() ? 'sintetizado' : 'simples'} · nível ${sfxLevel().toFixed(3)} · efeitos ${volLabel(prefs.sfxPct)} · música ${volLabel(prefs.musPct)}`,
    `Controle: ${pad.connected ? `${pad.id} (${pad.mapping || 'sem mapa padrão'})` : 'nenhum'}`,
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
// atalhos da pausa: música e efeitos sem abrir os ajustes (mudo / volta ao volume de antes)
function quickLabels() {
  $('qMusic').innerHTML = capsHtml(`MÚSICA: ${volLabel(prefs.musPct)}`);
  $('qSound').innerHTML = capsHtml(`EFEITOS: ${volLabel(prefs.sfxPct)}`);
  $('qMusic').classList.toggle('off', prefs.musPct <= 0);
  $('qSound').classList.toggle('off', prefs.sfxPct <= 0);
}
function quickMute(kind: 'sfx' | 'music') {
  const cur = kind === 'sfx' ? prefs.sfxPct : prefs.musPct;
  if (cur > 0) {
    savePrefs(kind === 'sfx' ? { sfxPrev: cur } : { musPrev: cur });
    actions.setVolume(kind, 0);
  } else actions.setVolume(kind, (kind === 'sfx' ? prefs.sfxPrev : prefs.musPrev) || 100);
  quickLabels();
}
$('qMusic').addEventListener('click', () => quickMute('music'));
$('qSound').addEventListener('click', () => quickMute('sfx'));
$('resume').addEventListener('click', () => setPaused(false));
// botões dos painéis da pausa, ajustes e saída: respondem ao soltar o dedo (no iPhone o primeiro
// toque às vezes só "passa por cima" do botão e o click não vem); o click de verdade que chega
// logo depois é ignorado, para não acionar duas vezes
let tapClickAt = 0;
for (const id of ['pause', 'settings', 'quitDlg']) {
  const panel = $(id);
  panel.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return; // no mouse o click já vem certo
    const b = (e.target as HTMLElement).closest('button');
    if (!b || !panel.contains(b)) return;
    tapClickAt = performance.now();
    // leva o ponto do toque (os volumes diminuem na metade esquerda do botão e aumentam na direita)
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, detail: 1 });
    (ev as MouseEvent & { synth?: boolean }).synth = true;
    b.dispatchEvent(ev);
  });
  panel.addEventListener('click', (e) => {
    if (!(e as MouseEvent & { synth?: boolean }).synth && performance.now() - tapClickAt < 800) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}
document.addEventListener('click', (e) => {
  // o click atrasado do toque que fechou a pausa cai no que estiver embaixo: ignora
  if (!(e as MouseEvent & { synth?: boolean }).synth && performance.now() - tapClickAt < 800) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);
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
setMusicVolume(prefs.menuPct / 100, prefs.musPct / 100);
setSfxVolume(prefs.sfxPct / 100);
function settingsLabels() {
  const lab: Record<string, [string, string]> = {
    volume: ['MÚSICA CORRIDA', `◀ ${volLabel(prefs.musPct)} ▶`],
    sfxvol: ['VOL. EFEITOS', `◀ ${volLabel(prefs.sfxPct)} ▶`],
    track: ['FAIXA ▶', musicTitle() || '-'],
    gear: ['CÂMBIO', state.auto ? 'AUTOMÁTICO' : 'MANUAL'],
    buttons: ['BOTÕES', btnSizeLabel()],
    ghost: ['FANTASMA', ghostOn() ? 'LIGADO' : 'DESLIGADO'],
    hints: ['DICAS', prefs.hints ? 'LIGADAS' : 'DESLIGADAS'],
    fps: ['MOSTRAR FPS', prefs.fps ? 'SIM' : 'NÃO'],
    fps30: ['QUADROS', prefs.fps30 ? '30 FPS' : '60 FPS'],
    fx: ['GRÁFICOS', FX_LABEL[fxMode()] + (fxMode() === 'auto' && lowFx() ? ' (ECO)' : '')],
    view: ['VISÃO DO PAINEL', VIEW_LEVELS[prefs.view].label],
  };
  document.querySelectorAll<HTMLButtonElement>('#settings [data-set]').forEach((b) => {
    const [k, v] = lab[b.dataset.set!];
    b.innerHTML = `${capsHtml(k)}<span>${capsHtml(v)}</span>`;
  });
}
let trackStep = 0;
// volume: toque na metade esquerda diminui, na direita aumenta (10%); Enter/A sem ponto de
// toque aumenta e, passando de 100%, volta ao mudo
function volClick(b: HTMLButtonElement, e: MouseEvent, kind: 'sfx' | 'music') {
  const r = b.getBoundingClientRect();
  const cur = kind === 'sfx' ? prefs.sfxPct : prefs.musPct;
  const pointed = e.detail > 0 && (e.clientX !== 0 || e.clientY !== 0);
  if (pointed) actions.setVolume(kind, cur + (e.clientX < r.left + r.width / 2 ? -10 : 10));
  else actions.setVolume(kind, cur >= 100 ? 0 : cur + 10);
}
document.querySelectorAll<HTMLButtonElement>('#settings [data-set]').forEach((b) => b.addEventListener('click', (e) => {
  switch (b.dataset.set) {
    case 'volume': volClick(b, e, 'music'); break;
    case 'sfxvol': volClick(b, e, 'sfx'); break;
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
    case 'view': savePrefs({ view: (prefs.view + 1) % VIEW_LEVELS.length }); resize(); break;
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
// não); em 60 FPS, no máximo um a cada ~16,7 ms (telas de 120 Hz ou mais pulam quadros); a física continua no passo fixo de 60 Hz, então o carro anda igual, só com menos
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
  // limite de quadros: 60 (ou 30 na opção QUADROS) também em monitores de 120/144/165 Hz, onde o
  // requestAnimationFrame vem mais vezes; os quadros pulados não contam no FPS (countFps só
  // conta os desenhados). Num monitor de 60 Hz todo quadro passa (a folga de 3 ms cobre o tremor)
  {
    const gap = 1000 / (prefs.fps30 ? 30 : 60);
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
  carSwapWatch(state.t);
  newFrame(); // orçamento de sprites novos por quadro
  const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); // o primeiro quadro pode vir antes de `last`
  last = now;
  state.t += dt;
  // controle Bluetooth: na corrida mexe direto nos comandos; nos menus vira navegação
  for (const k of pollGamepad()) {
    // tela CONTROLES esperando a tecla nova: o controle não mexe na escolha (nem a "rouba");
    // só o B/O cancela, como o Esc
    if (binding.action) {
      if (k === 'back') binding.action = null;
      continue;
    }
    if (k !== 'start' && (state.screen !== 'race' || paused || quitOpen()) && dupNav(k, 'pad')) continue;
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
Object.assign(window, { app: { state, actions, beginLoading, focusInfo: () => focusInfo(state), courses: COURSES, cars: CARS, get race() { return race; } }, input, audio: { audioCtx, synthReady, sfxLevel, gainLevels }, pad });

// app instalável: funciona sem internet (não no arquivo único usado para testes)
if ('serviceWorker' in navigator && import.meta.env.MODE !== 'single' && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
applyBtnSize(); // tamanho dos botões escolhido nas opções
