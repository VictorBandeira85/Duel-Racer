// Trilha baixada (OpenGameArt, todas CC0): 0-3 no menu, 4-19 nas corridas, na mesma numeração das
// faixas sintetizadas de music.ts, que tocam no lugar quando o arquivo não carrega (sem internet).
export interface FileTrack { file: string; title: string; artist: string }
const F = (file: string, title: string, artist: string): FileTrack => ({ file, title, artist });
export const FILE_TRACKS: FileTrack[] = [
  F('00-racing-game-title.mp3', 'Racing Game Title', 'MintoDog'),
  F('01-racing-game-menu.mp3', 'Racing Game Menu', 'MintoDog'),
  F('02-synthwave-4k.mp3', 'Synthwave 4k', 'cynicmusic'),
  F('03-midnight-drive.mp3', 'Midnight Drive', 'congusbongus'),
  F('04-cool-highway.mp3', 'Cool Highway', 'MintoDog'),
  F('05-cool-highway-climax.mp3', 'Cool Highway (Climax)', 'MintoDog'),
  F('06-hot-roadway.mp3', 'Hot Roadway', 'MintoDog'),
  F('07-pure-raceway.mp3', 'Pure Raceway', 'MintoDog'),
  F('08-pure-raceway-climax.mp3', 'Pure Raceway (Climax)', 'MintoDog'),
  F('09-neon-sign-circuit.mp3', 'Neon Sign Circuit', 'MintoDog'),
  F('10-sky-blue-street.mp3', 'Sky Blue Street', 'MintoDog'),
  F('11-darkness-road.mp3', 'Darkness Road', 'MintoDog'),
  F('12-fever-stadium.mp3', 'Fever Stadium', 'MintoDog'),
  F('13-synth-wave.mp3', 'Synth Wave', 'Pro Sensory'),
  F('14-space-synth-wave.mp3', 'Space Synth Wave', 'Pro Sensory'),
  F('15-aerobics-synth-wave.mp3', 'Aerobics Synth Wave', 'Pro Sensory'),
  F('16-slipstream.mp3', 'Slipstream', 'cinameng'),
  F('17-cyber-runner.mp3', 'Cyber Runner', 'ansimuz'),
  F('18-night-life.mp3', 'Night Life', 'Holizna'),
  F('19-fires-uptown.mp3', 'Fires Uptown', 'Holizna'),
];
export const MUSIC_CREDITS = `Música (CC0, OpenGameArt): ${[...new Set(FILE_TRACKS.map((t) => t.artist.replace(/ /g, '\u00a0')))].join(', ')}`; // nome não quebra no meio
// em linhas curtas, para caber na largura segura das telas
export const MUSIC_CREDIT_LINES = (() => {
  const out: string[] = [];
  let line = '';
  for (const w of MUSIC_CREDITS.split(' ')) {
    if (line && (line + ' ' + w).length > 66) {
      out.push(line);
      line = w;
    } else line = line ? line + ' ' + w : w;
  }
  return [...out, line];
})();
