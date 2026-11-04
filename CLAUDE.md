# Duel Racer — regras de trabalho

- Falar com o Victor em português, de forma concisa.
- Estilo: pixel art, nada irreal, sons sem agudos demais, interface de revista de carros dos anos 90,
  vidros dos carros sempre cor de vidro. Só marcas e logos fictícias (src/assets/brands.json).

## Publicação
- A cada rodada: só a versão web/mobile (artifact). `npm run build:single`,
  `node tools/to-artifact.mjs <scratchpad>/artifact/duel-racer.html`, publicar no mesmo artifact,
  commit e push em `main`. Subir a versão em `package.json` (e `desktop/package.json`).
- Versão de PC (`npm run desktop`, instalador e zip) **só com autorização explícita do Victor**.
- Nunca abrir PR.

## Arte
- Ao trocar, mover ou redesenhar qualquer elemento (mostradores, emblemas, luzes, peças), **sempre
  apagar os restos da arte antiga** sem precisar de pedido: aros, riscos de escala, faixas vermelhas,
  emblemas e marcações que fiquem fora do que o código desenha por cima. Conferir com print
  ampliado do jogo (não só do PNG) a área em volta do que foi mudado antes de publicar.
- Emblemas das marcas: `tools/ref/brand_badges.py`. Quadro da LP5: `tools/ref/lp5_cluster.py`.
