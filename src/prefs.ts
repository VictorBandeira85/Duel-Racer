// Ajustes do jogador (fps30: limita a 30 quadros por segundo, para máquinas mais fracas)
// que valem entre uma abertura e outra (volumes, câmbio, dicas na tela)
// sfxPct/musPct: volume dos efeitos e da música, de 0 (mudo) a 100%, em passos de 10;
// sfxPrev/musPrev: o volume de antes do atalho de mudo da pausa (para voltar a ele)
// view: VISÃO DO PAINEL (0 perto, como sempre foi; 1 normal; 2 longe: cabe o painel inteiro)
export interface Prefs { musSet: boolean; view: number; auto: boolean; hints: boolean; fps: boolean; fps30: boolean; sfxPct: number; musPct: number; sfxPrev: number; musPrev: number }
const KEY = 'duel-racer:ajustes';
// versões antigas: sound/music (ligado/desligado) + sfxVol/musVol (índice em 25/50/75/100%)
const OLD_VOLS = [25, 50, 75, 100];
const step10 = (v: number) => Math.max(0, Math.min(100, Math.round(v / 10) * 10));
export const prefs: Prefs = (() => {
  const d: Prefs = { musSet: false, view: 0, auto: true, hints: true, fps: false, fps30: false, sfxPct: 100, musPct: 50, sfxPrev: 100, musPrev: 50 }; // música começa em 50% (pedido do Victor)
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    /* sem armazenamento ou salvo estragado: fica o padrão */
  }
  const p = { ...d } as Prefs;
  for (const k of Object.keys(d) as (keyof Prefs)[]) if (typeof saved[k] === typeof d[k]) (p as unknown as Record<string, unknown>)[k] = saved[k];
  const old = (on: unknown, idx: unknown, fallback: number) => {
    const pct = OLD_VOLS[Math.max(0, Math.min(3, Number(idx ?? fallback)))] ?? 100;
    return { pct: on === false ? 0 : pct, prev: pct };
  };
  // musSet: o jogador já escolheu o volume da música (as versões 0.51/0.52 gravavam 100% sem ele escolher)
  if (saved.musSet !== true && typeof saved.musPct === 'number') {
    p.musPct = d.musPct;
    p.musPrev = d.musPrev;
  }
  if (typeof saved.sfxPct !== 'number') {
    const o = old(saved.sound, saved.sfxVol, 3);
    p.sfxPct = o.pct;
    p.sfxPrev = o.prev;
  }
  if (typeof saved.musPct !== 'number') {
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem('duel-racer:volume-musica');
    } catch {
      /* sem armazenamento */
    }
    // só migra quem já tinha mexido no som numa versão antiga; quem nunca escolheu fica nos 50% do padrão
    if (saved.music !== undefined || saved.musVol !== undefined || legacy !== null) {
      const n = Number(legacy ?? 3);
      const o = old(saved.music, saved.musVol, Number.isFinite(n) ? n : 3);
      p.musPct = o.pct;
      p.musPrev = o.prev;
    }
  }
  p.view = Math.max(0, Math.min(2, Math.round(p.view)));
  p.sfxPct = step10(p.sfxPct);
  p.musPct = step10(p.musPct);
  p.sfxPrev = step10(p.sfxPrev) || 100;
  p.musPrev = step10(p.musPrev) || 100;
  return p;
})();
export function savePrefs(p: Partial<Prefs>) {
  Object.assign(prefs, p);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* sem armazenamento */
  }
}
// texto do volume nos ajustes
export const volLabel = (pct: number) => (pct <= 0 ? 'MUDO' : `${pct}%`);
// VISÃO DO PAINEL: quantas colunas da arte da cabine a tela de corrida tenta mostrar (0 = como
// sempre: altura fixa de 224 linhas). Afastando, a tela ganha linhas em cima (mais para-brisa) e,
// por ficar mais alta, mais colunas dos lados; no máximo 96 linhas a mais
export const VIEW_LEVELS = [{ label: 'PERTO', cols: 0 }, { label: 'NORMAL', cols: 404 }, { label: 'LONGE', cols: 460 }];
// cap: linhas a mais que a cabine do carro aguenta (o teto construído acima da arte não fica bom
// em todas: ver VIEW_EXTRA_CAP em cockpit.ts)
export function raceViewSize(screenAspect: number, cap = 96) {
  const aspect = 8 / 7, cols = VIEW_LEVELS[prefs.view]?.cols ?? 0;
  const extra = cols ? Math.max(0, Math.min(cap, Math.round((cols * aspect) / screenAspect) - 224)) : 0;
  const h = 224 + extra;
  return { h, w: Math.round(Math.min(460, Math.max(256, (h * screenAspect) / aspect))) };
}
