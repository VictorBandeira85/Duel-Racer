// Mede a aceleração de cada carro direto no código do jogo (física em src/cars.ts),
// com câmbio automático, tempo de troca e atraso do turbo.
// Uso: node tools/sim/accel.mjs
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { CARS, Powertrain, LAUNCH_BOOST, resistAcc, toGame } = await server.ssrLoadModule('/src/cars.ts');
const KMH = 0.025;
for (const car of CARS) {
  const pt = new Powertrain(car);
  pt.boost = LAUNCH_BOOST;
  let v = 0, t = 0; const dt = 1 / 60; const marks = {};
  while (t < 90) {
    v += toGame(pt.step(v, true, dt) - resistAcc(car, v)) * dt;
    t += dt;
    for (const k of [100, 200, 250, 280, 300]) if (!marks[k] && v * KMH >= k) marks[k] = t.toFixed(1);
  }
  console.log(car.name.padEnd(10), 'trac', car.traction.toFixed(2), 'drag', car.drag.toExponential(2), '| 0-100', marks[100], '0-200', marks[200], '0-250', marks[250] ?? '-', '0-280', marks[280] ?? '-', '0-300', marks[300] ?? '-', '| máx 90s', Math.round(v * KMH), '/', Math.round(car.maxSpeed * KMH));
}
await server.close();
