// Ajustes do jogador (fps30: limita a 30 quadros por segundo, para máquinas mais fracas)
// que valem entre uma abertura e outra (volumes, câmbio, dicas na tela)
// sfxPct/musPct: volume dos efeitos e da música, de 0 (mudo) a 100%, em passos de 10;
// sfxPrev/musPrev: o volume de antes do atalho de mudo da pausa (para voltar a ele)
// view: VISÃO DO PAINEL, o zoom da cabine (0 perto: ampliada; 1 normal; 2 longe: reduzida). viewV: versão
// desse ajuste (até a 0.55 os níveis só mudavam a altura da cabine: quem vem de lá volta para o normal)
export interface Prefs { viewV: number; hud: boolean; menuPct: number; menuPrev: number; musSet: boolean; view: number; auto: boolean; hints: boolean; fps: boolean; fps30: boolean; sfxPct: number; musPct: number; sfxPrev: number; musPrev: number }
const KEY = 'duel-racer:ajustes';
// versões antigas: sound/music (ligado/desligado) + sfxVol/musVol (índice em 25/50/75/100%)
const OLD_VOLS = [25, 50, 75, 100];
const step10 = (v: number) => Math.max(0, Math.min(100, Math.round(v / 10) * 10));
export const prefs: Prefs = (() => {
  const d: Prefs = { viewV: 2, hud: true, menuPct: 50, menuPrev: 50, musSet: false, view: 1, auto: true, hints: true, fps: false, fps30: false, sfxPct: 100, musPct: 50, sfxPrev: 100, musPrev: 50 }; // música começa em 50% (pedido do Victor)
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
  if (saved.viewV !== 2) p.view = 1;
  p.viewV = 2;
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
// VISÃO DO PAINEL: zoom da cabine (a câmera do motorista mais perto ou mais longe do painel). O HUD não
// muda de tamanho: a cena (pista vista pelo vidro + cabine) é desenhada numa tela virtual de 224 / zoom
// linhas e ampliada/reduzida para as 224 linhas da tela de corrida (cockpit.ts, renderCockpitInner).
export const VIEW_LEVELS = [{ label: 'PERTO', zoom: 1.2 }, { label: 'NORMAL', zoom: 1 }, { label: 'LONGE', zoom: 0.9 }];
// vh: linhas da cena que aparecem; z = 224 / vh; cut: linhas de baixo da cabine que ficam fora (perto);
// cap: linhas a mais que a cabine do carro aguenta acima da arte ao afastar (VIEW_EXTRA_CAP em cockpit.ts)
export function viewZoom(cap = 96) {
  const want = VIEW_LEVELS[prefs.view]?.zoom ?? 1;
  const vh = want >= 1 ? Math.round(224 / want) : Math.min(Math.round(224 / want), 224 + Math.max(0, cap));
  // perto: das linhas que saem, um pouco menos da metade sai de baixo (console) e o resto do alto (céu)
  const cut = vh < 224 ? Math.round((224 - vh) * 0.45) : 0;
  return { z: 224 / vh, vh, cut };
}
// tela de corrida: sempre 224 linhas; a largura acompanha a tela até onde a arte da cabine (460
// colunas) dá conta no zoom escolhido (longe em tela larga: a imagem fica mais estreita, sem esticar)
export function raceViewSize(screenAspect: number, cap = 96) {
  const aspect = 8 / 7, { z } = viewZoom(cap);
  const want = Math.max(256, (224 * screenAspect) / aspect);
  const vw = Math.min(460, Math.round(want / z));
  return { h: 224, w: z === 1 ? Math.round(Math.min(460, want)) : Math.max(256, Math.min(520, Math.round(vw * z))) };
}
