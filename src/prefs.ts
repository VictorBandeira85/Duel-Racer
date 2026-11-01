// Ajustes do jogador que valem entre uma abertura e outra (som, música, câmbio, dicas na tela)
export interface Prefs { sound: boolean; music: boolean; auto: boolean; hints: boolean }
const KEY = 'duel-racer:ajustes';
export const prefs: Prefs = (() => {
  const d: Prefs = { sound: true, music: true, auto: true, hints: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return d;
  }
})();
export function savePrefs(p: Partial<Prefs>) {
  Object.assign(prefs, p);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* sem armazenamento */
  }
}
