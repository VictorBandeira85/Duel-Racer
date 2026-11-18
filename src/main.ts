import { preloadScenery, sceneryReady, type SpriteKind } from './sprites';
import { obraReady, preloadObra } from './obraart';
import { baseline, lowPrio } from './imgprio';
import { preloadBgArt } from './bgart';
import { carSwapWatch } from './carswap';
import { freeBudget, newFrame } from './svgsprites';
import { VIEW_LEVELS, gearLabel, nextGearMode, prefs, raceViewSize, savePrefs, volLabel } from './prefs';
import { clearArcade, loadArcade, saveArcade } from './arcadesave';
import { arcadePrepped, arcadeTuned } from './arcadeprep';
import { buildKey } from './tuning';
import { capsHtml } from './ui';
import { fieldPlace, stageResult } from './score';
import '@fontsource/press-start-2p/400.css';
import { CRES, RES, setCanvasRes, setRes, view } from './config';
import { CARS, TRAFFIC_IMAGES, carArtReady, trafficReady } from './cars';
import { COURSES, completeCourse, unlockedCourses, withTimeOfDay, type ArcadeTime, type Course } from './courses';
import { ui as careerUi } from './careerScreens';
import { afterEvent, attachRivalry, bindRivalry, planRun, regionOfEvent, roadOpts, settleStreet, streetEvent, streetOffer } from './rivalry';
import type { CareerEvent } from './career';
import { setupOf, buildOf, REGIONS, carById, driverCar, eventCourse, eventExtras, levels, loadCareer, logStage, rematchEvent, saveCareer, settleEvent, tunedCar, wearOf } from './career';
import { raceWear } from './usedcars';
import { addUse, healthOf } from './upkeep';
import type { CarSpec } from './cars';
import { Race } from './race';
import { overlayDraw, overlayKey, overlayOn, overlayTap, overlayType } from './overlay';
import { logWeek } from './weekly';
import { DRAG_COURSE, DragRace, dragHost } from './drag';
import { ghostOn, loadGhost, saveRun, setGhostOn } from './records';
import { CHALLENGE_PRIZE, checkChallenge, partialStats, saveMedal, stageAchievements, stageChallenges, toast } from './challenges';
import { paintHex } from './paint';
import { VIEW_EXTRA_CAP, cockpitRadioHit, cockpitReady, preloadCockpit, renderCockpit } from './cockpit';
import { attFor, attsReady, copsReady, preloadAtts } from './people';
import { OPT_TABS, applyBtnSize, beginLoading, optTab, setOptTab, btnSizeLabel, cycleBtnSize, drawScreen, drawToast, focusInfo, preloadGasArt, hoverScreen, keyScreen, setScreenActions, saveScore, tapScreen, type Actions, type AppState, type MenuKey, type ScreenId } from './screens';
import { binding, binds, hornOn, input, lastDevice, pad, pollGamepad, releaseAll, setBind, setupInput, takeShift, touch } from './input';
import { setHorn, setHornCar } from './horn';
import { MUSIC_CREDITS } from './tracks';
import { audioCtx, audioState, gainLevels, resumeAudio, sfxLevel, synthReady, setSfxVolume, initAudio, musicTitle, suspendAudio, playMusic, setEngine, setMusicVolume, setSiren, setTires, STATIONS, nextRadioStation, radioStation, setRadioStation } from './audio';
import { stopTrafficAudio } from './trafficaudio';
import { dailyFor, markStart, ruleOk, saveDaily } from './daily';
import { dlast, dsel, setEndFocus } from './dailyScreens';
import { preloadSvg } from './svgsprites';
import { FX_LABEL, fxMode, lowFx, perfSample, setFxMode, lowRes, minRes, perfKey } from './perf';
import { F40_REAR, F40_SIDE, F40_WHEEL } from './svg/f40';

// (o pré-carregamento geral vai em segundo plano: ver lowPrio mais abaixo)
import { preloadPhotos } from './photos';
// esmaecer entre telas, como no Super Nintendo: ao trocar de tela, a anterior escurece até o preto e a
// nova clareia do preto, em degraus (o brilho do SNES tinha 16 níveis). A tela anterior é a imagem que
// ainda está no canvas no quadro em que a troca acontece (copiada só nesse quadro)
const FADE_OUT = 0.16, FADE_IN = 0.24;
let fadeScreen = '', fadeT = -1;
const fadeCv = document.createElement('canvas');
let fadeSnapped = false;
// guarda a última imagem da tela (chamado também antes de o canvas mudar de tamanho, que o apaga)
function snapFade() {
  if (fadeSnapped || !canvas.width) return;
  if (fadeCv.width !== canvas.width || fadeCv.height !== canvas.height) { fadeCv.width = canvas.width; fadeCv.height = canvas.height; }
  fadeCv.getContext('2d')!.drawImage(canvas, 0, 0);
  fadeSnapped = true;
}
function fadeLevel(k: number) {
  return Math.round(Math.max(0, Math.min(1, k)) * 15) / 15; // 0 = imagem cheia, 1 = preto
}

// pré-carregamento geral em segundo plano: na fila do artifact, o que a tela atual precisa passa na frente
const preloadAll = () => {
  preloadSvg(F40_SIDE, F40_REAR, F40_WHEEL, ...CARS.flatMap((c) => [c.imgSide, c.sideMask, c.rear.img, c.rear.imgMask, c.rear.frontImg, c.rear.frontMask]).filter((s): s is string => !!s), ...TRAFFIC_IMAGES);
  preloadPhotos();
  preloadScenery();
  preloadObra(); // cones, placas, máquinas e sinaleiro da obra/blitz (pequenas: vão dentro da página)
  preloadGasArt();
  preloadAtts();
  preloadBgArt(); // fundos desenhados (relevo do horizonte)
};
if (baseline()) preloadAll();
else lowPrio(preloadAll);

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
bindRivalry(() => state); // a ficha e as falas dos rivais seguem o histórico da carreira carregada

// corrida em andamento: percurso, carro (com melhorias, na carreira) e rival
interface Run {
  course: Course;
  car: CarSpec;
  rival: CarSpec | null;
  opts: { rivalStyle?: import('./race').RivalStyle; rivalPaint?: string; copClass?: import('./cars').PerfClass; extras?: import('./race').ExtraDef[] };
  event?: { region: number; event: number; rematch?: boolean; street?: CareerEvent }; // street: racha de rua (rivalry.ts)
  drag?: boolean; // arrancada 402 m (drag.ts)
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
  $('radioBtn').classList.toggle('hidden', !on);
  if (!on) $('radioTag').classList.add('hidden');
  $('gearBtns').classList.toggle('hidden', state.auto);
  $('clutchBtn').classList.toggle('hidden', state.auto || !prefs.clutch);
  $('pause').classList.add('hidden');
  paused = false;
}

// Arcade: o carro entra com as peças da OFICINA do Arcade (arcadeprep.ts, separadas da carreira)
function arcadeCar() {
  return arcadeTuned(CARS[state.carIdx]);
}
// carro preparado (peças instaladas): o recorde por trecho fica separado do de fábrica
const runPrepped = () => (state.mode === 'arcade' ? arcadePrepped(run.car.id) : state.mode === 'career' && !!state.career && !!buildKey(buildOf(state.career, run.car.id)));
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
  // desafio do dia: um trecho, o carro de fábrica e o rival sorteados pela data (daily.ts)
  startDaily(date: string) {
    const d = dailyFor(date);
    dsel.date = date;
    dlast.r = null;
    dlast.code = '';
    setEndFocus(0);
    state.mode = 'daily';
    markStart();
    state.courseIdx = d.courseIdx; // música do roteiro de onde saiu o trecho
    run = { course: d.course, car: d.car, rival: d.rival, opts: {} };
    begin(3);
  },
  // continua o roteiro do Arcade de onde parou (trechos feitos e carros restantes), com o carro
  // e o rival escolhidos agora (pode trocar de carro no meio do roteiro)
  resumeCourse() {
    const sv = loadArcade();
    if (!sv || !COURSES[sv.courseIdx]) return;
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
  startEvent(region: number, event: number, rematch = false) {
    const cs = state.career!;
    const base = REGIONS[region].events[event];
    const ev = rematch ? rematchEvent(base) : base; // revanche: o rival vencido, mais afiado
    careerUi.region = region;
    careerUi.event = event;
    careerUi.rematch = rematch;
    state.mode = 'career';
    state.carIdx = CARS.findIndex((c) => c.id === cs.car);
    run = {
      // carro usado: os defeitos entram na ficha (potência, aderência)
      course: eventCourse(ev, cs.races), car: tunedCar(carById(cs.car), levels(cs, cs.car), setupOf(cs, cs.car), buildOf(cs, cs.car), wearOf(cs, cs.car), healthOf(cs, cs.car)),
      rival: driverCar(ev.driver), // preparadores: o carro com as peças deles
      opts: {
        rivalStyle: ev.driver.style, rivalPaint: ev.driver.paint, copClass: REGIONS[region].cls,
        // figurantes do evento (carro de fábrica, um pouco menos afiados que o rival)
        extras: eventExtras(ev).map((d) => ({ car: carById(d.car), paint: d.paint, style: d.style, skill: d.skill, name: d.name })),
      },
      event: { region, event, rematch },
    };
    planRun(cs, ev); // rivalidade: desafio na estrada, rádio e notas do resultado (rivalry.ts)
    begin(4);
  },
  // racha de rua noturno (convite pendente): o rival do convite, um trecho, aposta em dinheiro ou o carro
  startStreet(pink: boolean, bet: number) {
    const cs = state.career!;
    const ev = streetEvent(cs);
    if (!ev) return;
    const region = Math.max(0, regionOfEvent(streetOffer(cs)!.ev));
    state.mode = 'career';
    state.carIdx = CARS.findIndex((c) => c.id === cs.car);
    run = {
      course: eventCourse(ev, cs.races), car: tunedCar(carById(cs.car), levels(cs, cs.car), setupOf(cs, cs.car), buildOf(cs, cs.car), wearOf(cs, cs.car), healthOf(cs, cs.car)),
      rival: driverCar(ev.driver),
      opts: { rivalStyle: ev.driver.style, rivalPaint: ev.driver.paint, copClass: REGIONS[region].cls },
      event: { region, event: 0, street: ev },
    };
    planRun(cs, ev, { pink, bet });
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
// arrancada 402 m (drag.ts, telas em dragScreens.ts): um tiro só, com a cabine normal do carro
dragHost.start = (car, rival) => {
  state.mode = 'arcade';
  run = { course: DRAG_COURSE, car, rival, opts: {}, drag: true };
  begin(1);
};
dragHost.again = () => startStage(0);

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
const stageKinds = new WeakMap<Race, Set<SpriteKind>>();
function stageArtReady(r: Race) {
  let kinds = stageKinds.get(r);
  if (!kinds) {
    kinds = new Set();
    for (const sg of r.track.segments) for (const sp of sg.sprites) kinds.add(sp.kind);
    stageKinds.set(r, kinds);
  }
  // sem atalho: tudo o que falta é pedido com prioridade de uma vez
  const checks = [sceneryReady(kinds), trafficReady(), carArtReady(r.car), !r.rivalCar || carArtReady(r.rivalCar), ...r.extras.map((e) => carArtReady(e.car)), copsReady(r.copId), attsReady(attFor(r.def.theme)), (r.obra == null && r.blitz == null) || obraReady()];
  return checks.every(Boolean);
}
function startStage(i: number) {
  preloadCockpit(run.car.dash);
  showControls(false);
  warm = null;
  beginLoading(state, () => startStageNow(i), undefined, () => cockpitReady(run.car.dash) && warmUp(i));
  // (warmUp monta a corrida, espera as artes do trecho e só então aquece os primeiros quadros)
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
  // artes do trecho (cenário do tema, trânsito, carros, policial da classe, frentista da região): o
  // aquecimento e a corrida só começam com elas prontas (senão os objetos apareciam depois, no desenho antigo)
  if (!baseline() && !stageArtReady(warm.r)) return false;
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
  showRadio(2.2); // o visor do rádio mostra a estação na largada
}
function makeRace(i: number) {
  if (run.drag) return new DragRace(run.car, run.rival, state.auto, () => actions.go('dragEnd'));
  // rival à frente no 1º trecho; depois, quem chegou primeiro ao posto no trecho anterior
  // larga atrás e o outro à frente (vale no Arcade e na Carreira)
  const prev = i > 0 ? state.results[i - 1] : undefined;
  const rivalAhead = !prev || !(prev.rival < 0 || prev.time <= prev.rival);
  // procurado pela polícia: na carreira, multas e fugas acumuladas no save; no Arcade, as multas do roteiro
  const wanted = state.mode === 'career' ? (state.career?.wanted ?? 0) / 6 : state.results.reduce((a, q) => a + (q.tickets || 0), 0) * 0.2; // (saves antigos sem multas: 0)
  // figurantes: à frente na largada quem chegou antes do jogador no trecho anterior
  const extrasAhead = run.opts.extras?.map((_, k) => !prev || (prev.extras?.[k] ?? Infinity) < prev.time);
  const r = new Race(run.course, i, run.car, run.rival, state.auto, roadOpts(i, { ...run.opts, rivalAhead, wanted, extrasAhead })); // + rival desafiando na estrada
  preloadGasArt(r.def.theme); // posto do mapa deste trecho
  r.ghostRun = loadGhost(run.course.id, i, true);
  r.showGhost = ghostOn();
  r.challenges = stageChallenges(r);
  // carro usado da carreira: capô amassado, fumaça e trincas desde a largada (e de novo no carro novo)
  const wear = state.mode === 'career' && state.career ? wearOf(state.career, run.car.id) : [];
  if (wear.length) {
    r.wear = raceWear(wear, run.car.id.length * 131 + 7);
    r.damage = r.wear.damage;
    r.glass = [...r.wear.glass];
  }
  liveDone = new Set();
  r.onArrive = () => {
    if (state.mode === 'arcade') logWeek(run.course.id, i, r.time); // ranking da semana (weekly.ts)
    const res = stageResult(r);
    const sv = saveRun(r, run.course.id, i, paintHex(run.car.id), runPrepped());
    res.best = sv.prev;
    res.record = sv.record;
    // desafios do trecho: medalha (1 bronze, 2 prata, 3 ouro) e, na carreira, dinheiro
    res.challenges = r.challenges.map((ch) => ({ label: ch.label, done: checkChallenge(ch, r, true) }));
    const medal = res.challenges.filter((q) => q.done).length;
    res.medal = medal;
    res.medalNew = state.mode === 'daily' ? false : saveMedal(run.course.id, i, medal); // medalhas são dos roteiros
    if (state.mode === 'career' && state.career && medal) {
      res.prize = medal * CHALLENGE_PRIZE;
      state.career.money += res.prize;
      saveCareer(state.career);
    }
    // ficha na polícia (carreira): cada multa e cada fuga somam; trecho sem nada com a polícia alivia
    if (state.mode === 'career' && state.career) {
      const w = state.career.wanted ?? 0, hits = r.tickets + r.escapes;
      const nw = hits ? Math.min(12, w + hits) : Math.max(0, w - 0.5);
      if (nw !== w) {
        state.career.wanted = nw;
        saveCareer(state.career);
      }
    }
    stageAchievements(r, {
      won: res.rival >= 0 && res.time <= res.rival, record: sv.record && sv.prev !== undefined, medal,
      unlocked: unlockedCourses(), legend: run.course.id === 'lendas' && i === run.course.stages.length - 1,
    });
    state.results.push(res);
    // estatísticas da carreira: km, multas, fugas, batidas, motos derrubadas e máxima do trecho
    if (state.mode === 'career' && state.career) logStage(state.career, run.car.id, { ...res, escapes: r.escapes, falls: r.stats.falls });
    if (state.mode === 'career' && state.career) addUse(state.career, run.car.id, r.use); // desgaste de pneus e motor (upkeep.ts)
    if (r.clean) state.lives++;
    if (state.mode === 'arcade') {
      saveArcade({ course: run.course.id, courseIdx: state.courseIdx, carIdx: state.carIdx, oppIdx: state.oppIdx, night: state.arcadeTime === 'night', time: state.arcadeTime, lives: state.lives, results: state.results });
    }
    state.gasPage = 0;
    state.gasNight = !!r.def.night && !r.def.dusk;
    state.gasTheme = r.def.theme; // frentista da região do trecho
    state.gasWeather = r.def.weather; // chuva e neve continuam no posto
    // marcas do trecho no carro visto de lado no posto (batidas, encostões e o dano que ficou)
    state.gasDmg = Math.min(1, r.damage * 0.8 + r.crashes * 0.35 + r.stats.scrapes * 0.04);
    actions.go('gas');
  };
  r.onCrash = () => {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      if (state.mode === 'career') settle(false, r);
      else if (state.mode === 'daily') finishDaily(r);
      else {
        clearArcade(); // sem carros: o roteiro acabou
        actions.go('end');
      }
    }
  };
  return attachRivalry(r, i); // rádio do rival e desafio na estrada (só na carreira)
}

// resultado de um evento da carreira (dinheiro, prêmio, progresso)
function settle(won: boolean, last?: Race) {
  const base = REGIONS[run.event!.region].events[run.event!.event];
  const ev = run.event!.street ?? (run.event!.rematch ? rematchEvent(base) : base);
  const res = state.results;
  const fines = res.reduce((a, r) => a + (r.fines ?? 0), 0) + (last && state.gameOver ? last.fines : 0);
  const crashes = res.reduce((a, r) => a + r.crashes, 0) + (last && state.gameOver ? last.crashes : 0);
  // trecho interrompido (os carros acabaram): o que rodou dele também conta nas estatísticas
  if (last && state.gameOver && state.career) {
    const done = stageResult(last);
    logStage(state.career, run.car.id, { km: done.km * last.progress, top: done.top, tickets: last.tickets, crashes: last.crashes, escapes: last.escapes, falls: last.stats.falls });
    addUse(state.career, run.car.id, last.use);
  }
  const time = won ? res.reduce((a, r) => a + r.time, 0) : 0;
  // figurantes: posição final entre todos e quantos ficaram para trás (bônus em settleEvent)
  const fp = state.gameOver ? null : fieldPlace(res);
  state.careerResult = run.event!.street ? settleStreet(state.career!, ev, won, state.gameOver, fines, crashes)
    : settleEvent(state.career!, ev, won, state.gameOver, res.filter((r) => r.clean).length, fines, crashes, time, fp ?? undefined);
  afterEvent(state.career!, ev, won, state.gameOver, res, fines, crashes); // histórico do rival, patrocínio, convite de racha
  actions.go('careerEnd');
}

// fim do desafio do dia: confere a regra, guarda o melhor tempo do dia e mostra o resultado.
// crashed: os carros acabaram no meio do trecho (sem tempo)
function finishDaily(crashed?: Race) {
  const d = dailyFor(dsel.date);
  const res = crashed ? null : state.results[state.results.length - 1];
  const ok = !!res && ruleOk(d, res);
  const sv = saveDaily(d, res ? res.time : null, ok);
  dlast.r = {
    time: res ? res.time : null, ok, prev: sv.prev, best: sv.best, gameOver: !res,
    crashes: res ? res.crashes : crashed!.crashes, avg: res ? res.avg : 0, top: res ? res.top : 0, rival: res ? res.rival : -1,
  };
  actions.go('dailyEnd');
}

function finishCourse() {
  if (state.mode === 'daily') return finishDaily();
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
  saveScore(course, { time: total, car: CARS[state.carIdx].name + (runPrepped() ? ' PREPARADO' : ''), won: !rivalOk || total <= rival, score: state.results.reduce((a, r) => a + r.score, 0) });
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
  // VISÃO DO PAINEL (zoom da cabine): a largura da tela de corrida acompanha o zoom escolhido
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
  setCanvasRes(dense && !minRes() ? 4 : 2); // (no degrau mínimo do automático a tela toda cai para 2x)
  if (state.screen !== fadeScreen && fadeScreen && (canvas.width !== view.w * CRES || canvas.height !== view.h * CRES)) snapFade();
  canvas.width = view.w * CRES;
  canvas.height = view.h * CRES;
  ctx.setTransform(CRES, 0, 0, CRES, 0, 0);
  ctx.imageSmoothingEnabled = false;
  canvas.style.width = `${view.w * view.aspect * scale}px`;
  canvas.style.height = `${view.h * scale}px`;
}

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  // placa e ranking da semana (overlay.ts): o toque é deles
  if (overlayOn()) return overlayTap(((e.clientX - rect.left) / rect.width) * view.w, ((e.clientY - rect.top) / rect.height) * view.h);
  if (state.screen === 'race') {
    // toque no rádio desenhado na cabine (onde a arte tem um): troca a estação
    if (race && !paused && !quitOpen() && cockpitRadioHit(((e.clientX - rect.left) / rect.width) * view.w, ((e.clientY - rect.top) / rect.height) * view.h)) switchRadio();
    return;
  }
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
  if (overlayOn()) {
    if (overlayType(e)) return e.preventDefault();
    const ok = menuKey(e.code);
    if (ok && !dupNav(ok, 'key')) overlayKey(ok);
    if (ok) e.preventDefault();
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
const settingsOpen = () => !$('settings').classList.contains('hidden');
// primeiro item da aba nos ajustes (depois das quatro fichas)
const firstSetIdx = () => Math.max(0, panelButtons().findIndex((b) => !!b.dataset.set));
function panelKey(k: MenuKey) {
  const bs = panelButtons();
  const cur = bs[((focusIdx % bs.length) + bs.length) % bs.length];
  const vol = cur && VOL_SET[cur.dataset.set ?? ''];
  const onTab = !!cur?.dataset.tab;
  // ajustes: LB/RB (Q/E, PageUp/PageDown) trocam de aba; o foco fica nas fichas se estava nelas,
  // senão vai ao primeiro item; esquerda/direita numa ficha também trocam de aba
  if (settingsOpen() && !quitOpen() && (k === 'prevTab' || k === 'nextTab' || (onTab && (k === 'left' || k === 'right')))) {
    setOptTab(optTab.i + (k === 'nextTab' || k === 'right' ? 1 : -1));
    settingsLabels();
    focusIdx = onTab ? optTab.i : firstSetIdx();
  } else if (settingsOpen() && !quitOpen() && onTab && (k === 'down' || k === 'up')) {
    if (k === 'down') focusIdx = firstSetIdx(); // acima das fichas não há nada
  }
  else if (settingsOpen() && !quitOpen() && k === 'up' && cur && bs.indexOf(cur) === firstSetIdx()) focusIdx = optTab.i; // do primeiro item sobe para a ficha da aba atual
  else if (vol && (k === 'left' || k === 'right')) {
    // nos volumes, esquerda/direita diminuem/aumentam 10%
    actions.setVolume(vol, (vol === 'sfx' ? prefs.sfxPct : prefs.musPct) + (k === 'right' ? 10 : -10));
    settingsLabels();
  } else if (k === 'up' || k === 'down' || k === 'left' || k === 'right') focusIdx = panelStep(bs, focusIdx, k);
  else if (k === 'ok') {
    // continua no mesmo botão (ligar/desligar música); trocou de painel, começa do primeiro
    const before = panelButtons()[0];
    bs[((focusIdx % bs.length) + bs.length) % bs.length]?.click();
    if (panelButtons()[0] !== before) focusIdx = settingsOpen() && !quitOpen() ? firstSetIdx() : 0;
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
  $('nowPlaying').textContent = nowPlayingText();
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
// ---- rádio do carro: tecla R (trocável), Select do controle, botão ao lado da pausa e AJUSTES ----
setRadioStation(prefs.radio, false);
let radioHide = 0, radioFade = 0;
const nowPlayingText = () => {
  const s = STATIONS[radioStation()];
  return s.id === 'off' ? '♪ RÁDIO DESLIGADO' : musicTitle() ? `♪ ${s.freq} · ${musicTitle()}` : '';
};
// visor do rádio por alguns segundos (estação e faixa) e a etiqueta do botão
function showRadio(sec: number) {
  const s = STATIONS[radioStation()];
  $('radioShort').textContent = s.short;
  $('radioBtn').classList.toggle('off', s.id === 'off');
  $('radioFreq').textContent = s.freq;
  $('radioName').textContent = s.name;
  $('radioSong').textContent = s.id === 'off' ? '' : musicTitle().toUpperCase();
  const tag = $('radioTag');
  tag.classList.remove('hidden', 'fade');
  clearTimeout(radioHide);
  clearTimeout(radioFade);
  radioFade = window.setTimeout(() => tag.classList.add('fade'), sec * 1000);
  radioHide = window.setTimeout(() => tag.classList.add('hidden'), sec * 1000 + 400);
}
function switchRadio() {
  savePrefs({ radio: nextRadioStation() });
  showRadio(2.6);
}
$('radioBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (state.screen !== 'race' || paused || quitOpen()) return;
  initAudio();
  switchRadio();
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
  actions.go(run.drag ? 'drag' : 'title');
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
    radio: ['RÁDIO ▶', `${STATIONS[radioStation()].freq} ${STATIONS[radioStation()].name}`],
    gear: ['CÂMBIO', gearLabel(state.auto)],
    buttons: ['BOTÕES', btnSizeLabel()],
    ghost: ['FANTASMA', ghostOn() ? 'LIGADO' : 'DESLIGADO'],
    hints: ['DICAS', prefs.hints ? 'LIGADAS' : 'DESLIGADAS'],
    fps: ['MOSTRAR FPS', prefs.fps ? 'SIM' : 'NÃO'],
    fps30: ['QUADROS', prefs.fps30 ? '30 FPS' : '60 FPS'],
    fx: ['GRÁFICOS', FX_LABEL[fxMode()] + (fxMode() === 'auto' && lowFx() ? ' (ECO)' : '')],
    view: ['VISÃO DO PAINEL', VIEW_LEVELS[prefs.view].label],
    hud: ['PAINEL DIGITAL', prefs.hud ? 'LIGADO' : 'DESLIGADO'],
  };
  document.querySelectorAll<HTMLButtonElement>('#settings [data-set]').forEach((b) => {
    const [k, v] = lab[b.dataset.set!];
    b.innerHTML = `${capsHtml(k)}<span>${capsHtml(v)}</span>`;
    b.classList.toggle('hidden', Number(b.dataset.in) !== optTab.i); // só os itens da aba escolhida
  });
  // abas (as mesmas dos ajustes do menu, e a escolhida também)
  document.querySelectorAll<HTMLButtonElement>('#settings [data-tab]').forEach((b) => {
    const i = Number(b.dataset.tab);
    b.innerHTML = capsHtml(OPT_TABS[i]);
    b.classList.toggle('on', i === optTab.i);
  });
}
document.querySelectorAll<HTMLButtonElement>('#settings [data-tab]').forEach((b) => b.addEventListener('click', () => {
  setOptTab(Number(b.dataset.tab));
  settingsLabels();
  // teclado/controle: o foco continua na ficha tocada
  focusIdx = optTab.i;
  if (document.querySelector('.kfocus')) showFocus();
}));
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
    case 'radio': savePrefs({ radio: nextRadioStation() }); break;
    case 'gear':
      state.auto = nextGearMode(state.auto);
      if (race) race.auto = state.auto;
      $('gearBtns').classList.toggle('hidden', state.auto);
      $('clutchBtn').classList.toggle('hidden', state.auto || !prefs.clutch);
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
    case 'hud': savePrefs({ hud: !prefs.hud }); break;
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
  $('nowPlaying').textContent = nowPlayingText();
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
let lastKey = '';
const gearEl = document.getElementById('gearNum')!;
function frameInner(now: number) {
  if (fadeScreen !== state.screen) {
    if (fadeScreen) {
      if (!fadeSnapped) snapFade();
      fadeT = 0;
    }
    fadeSnapped = false;
    fadeScreen = state.screen;
  }
  frameMain(now);
  if (fadeT >= 0) {
    fadeT += Math.max(0, Math.min(0.05, (now - fadeLast) / 1000));
    const g = ctx;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (fadeT < FADE_OUT) {
      g.drawImage(fadeCv, 0, 0, canvas.width, canvas.height);
      g.fillStyle = `rgba(0,0,0,${fadeLevel(fadeT / FADE_OUT)})`;
    } else g.fillStyle = `rgba(0,0,0,${fadeLevel(1 - (fadeT - FADE_OUT) / FADE_IN)})`;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.restore();
    if (fadeT >= FADE_OUT + FADE_IN) fadeT = -1;
  }
  fadeLast = now;
}
let fadeLast = 0;
const fading = () => fadeT >= 0 && fadeT < FADE_OUT + FADE_IN * 0.5;
function frameMain(now: number) {
  carSwapWatch(state.t);
  // o visor do rádio não fica por cima do papel da multa
  $('radioTag').classList.toggle('blocked', state.screen === 'race' && race?.officer?.phase === 'show');
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
    if (overlayOn()) {
      if (k === 'start' || !dupNav(k, 'pad')) overlayKey(k);
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
  // rádio (tecla R ou Select do controle): só na corrida, fora da pausa; nos menus o aperto se perde
  if (takeShift('radio') && state.screen === 'race' && race && !paused && !quitOpen()) switchRadio();
  // buzina do jogador (tecla H/B, botão da tela, X ou Y do controle): só na corrida, fora da pausa
  if (race) setHornCar(race.car.id);
  setHorn(state.screen === 'race' && !!race && !paused && !quitOpen() && hornOn());
  if (state.screen === 'race' && race) {
    if (!paused && !fading()) {
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
      if (perfKey() !== lastKey) {
        lastKey = perfKey();
        resize();
      }
      renderCockpit(ctx, race, state.lives, run.drag ? '402 M' : `${race.stageIdx + 1}/${run.course.stages.length}`, run.drag ? 0 : totalTime(), paused ? 0 : dt);
    } else drawScreen(ctx, state);
  } else {
    acc = 0;
    drawScreen(ctx, state);
  }
  // na largada o quadro de desafios ocupa o alto do para-brisa: o aviso aparece logo abaixo dele
  const chBox = state.screen === 'race' && race && race.challenges.length && (race.state === 'countdown' || (race.state === 'drive' && race.time < 5));
  // na tela do posto o aviso fica abaixo da placa POSTO DUELO
  overlayDraw(ctx, dt);
  drawToast(ctx, dt, chBox ? 38 + race!.challenges.length * 6 : state.screen === 'gas' && !state.gasPage ? 44 : 0);
}
// abertura: página de carregamento enquanto as artes dos carros chegam, depois a capa
beginLoading(state, () => actions.go('title'), 1.4);
requestAnimationFrame(frame);

// para testes automatizados
Object.assign(window, { app: { artReady: { car: (id: string) => carArtReady(CARS.find((c) => c.id === id)!), stage: () => !!race && stageArtReady(race) }, state, actions, beginLoading, focusInfo: () => focusInfo(state), courses: COURSES, cars: CARS, get race() { return race; }, careerUi }, input, audio: { audioCtx, synthReady, sfxLevel, gainLevels }, pad });

// app instalável: funciona sem internet (não no arquivo único usado para testes)
if ('serviceWorker' in navigator && import.meta.env.MODE !== 'single' && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
applyBtnSize(); // tamanho dos botões escolhido nas opções
