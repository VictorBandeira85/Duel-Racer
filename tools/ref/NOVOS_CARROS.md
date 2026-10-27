# Como entram os carros nacionais

As fichas técnicas dos 20 carros já estão em `src/carsbr.ts` (classes D e C, medidas por
`node tools/sim/perf.mjs`). Um carro aparece no jogo sozinho quando existirem os sprites dele:

| Arquivo (em `src/assets/cars/`) | Obrigatório | Como gerar a partir da arte |
|---|---|---|
| `<id>-side.png` (300 px de largura) | sim | `python3 tools/ref/import_art.py lateral.png src/assets/cars/<id>-side.png 300` |
| `<id>-rear.png` (200 px) | sim | `python3 tools/ref/import_art.py traseira.png src/assets/cars/<id>-rear.png 200` |
| `<id>-front.png` (200 px) | não (retrovisor) | `python3 tools/ref/import_art.py frente.png src/assets/cars/<id>-front.png 200` |
| `<id>-side-mask.png` etc. | não (pintura) | `python3 tools/ref/body_mask.py <png> <matiz0> <matiz1>` |
| cabine | não (usa a cabine genérica) | `python3 tools/ref/import_cockpit.py interior.png src/assets/cockpit <id>` + entrada em `COCKPIT_ART` |

Se o teto ou as colunas saírem vazados (branco confundido com o fundo), use
`--fechar=y0:y1[:x0:x1]` no `import_art.py`.

`<id>` é o `id` da ficha (ex.: `br-golgti`). Depois de importar, confira a ficha (peso, cv,
0-100, máxima) e rode `node tools/sim/perf.mjs` para ver a classe.
