// Ajustes do jogador (fps30: limita a 30 quadros por segundo, para máquinas mais fracas)
// que valem entre uma abertura e outra (som, música, câmbio, dicas na tela)
export interface Prefs { sound: boolean; music: boolean; auto: boolean; hints: boolean; fps: boolean; fps30: boolean; sfxVol: number; musVol: number }
const KEY = 'duel-racer:ajustes';
export const prefs: Prefs = (() => {
  const d: Prefs = { sound: true, music: true, auto: true, hints: true, fps: false, fps30: false, sfxVol: 3, musVol: (() => { try { return Math.max(0, Math.min(3, Number(localStorage.getItem('duel-racer:volume-musica') ?? 3))); } catch { return 3; } })() };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return d;
  }
})();
// volumes (índice em VOLS): música e efeitos separados
export const VOLS = [0.25, 0.5, 0.75, 1];
export function savePrefs(p: Partial<Prefs>) {
  Object.assign(prefs, p);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* sem armazenamento */
  }
}
