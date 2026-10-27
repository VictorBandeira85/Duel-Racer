// Índice de desempenho (PI) de cada carro, medido na física do jogo. Uso: node tools/sim/perf.mjs
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { CARS, perfIndex, perfClass } = await server.ssrLoadModule('/src/cars.ts');
for (const car of [...CARS].sort((a, b) => perfIndex(b) - perfIndex(a))) console.log(car.name.padEnd(12), perfClass(car), perfIndex(car));
await server.close();
