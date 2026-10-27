// Índice de desempenho (PI) e classe de cada carro, medidos na física do jogo.
// Inclui os carros nacionais que ainda esperam a arte. Uso: node tools/sim/perf.mjs
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { CARS, perfIndex, perfClass, calibrate, KMH_ } = await server.ssrLoadModule('/src/cars.ts');
const { BR_CARS } = await server.ssrLoadModule('/src/carsbr.ts');
const all = [...CARS, ...BR_CARS.filter((c) => !CARS.includes(c)).map((c) => calibrate(c))];
for (const car of all.sort((a, b) => perfIndex(b) - perfIndex(a)))
  console.log(car.name.padEnd(16), perfClass(car), String(perfIndex(car)).padStart(4), car.pendingArt ? '(esperando arte)' : '', '|', car.basedOn);
await server.close();
