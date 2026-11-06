# Duel Racer — regras de trabalho

- Falar com o Victor em português, de forma concisa.
- Estilo: pixel art, nada irreal, sons sem agudos demais, interface de revista de carros dos anos 90,
  vidros dos carros sempre cor de vidro. Só marcas e logos fictícias (src/assets/brands.json).

## Publicação
- A cada rodada: só a versão web/mobile (artifact). `npm run build:single`,
  `node tools/to-artifact.mjs <scratchpad>/artifact/duel-racer.html`, publicar no mesmo artifact,
  commit e push em `main`. Subir a versão em `package.json` (e `desktop/package.json`).
- Versão de PC (`npm run desktop`, instalador e zip) **só com autorização explícita do Victor**.
- Versão Android (APK): `ANDROID_HOME=<sdk> bash android/build.sh` (WebView com o jogo dentro;
  a chave android/key.jks fica fora do git). Só quando o Victor pedir.
- Nunca abrir PR.

## Arte
- Ao trocar, mover ou redesenhar qualquer elemento (mostradores, emblemas, luzes, peças), **sempre
  apagar os restos da arte antiga** sem precisar de pedido: aros, riscos de escala, faixas vermelhas,
  emblemas e marcações que fiquem fora do que o código desenha por cima. Conferir com print
  ampliado do jogo (não só do PNG) a área em volta do que foi mudado antes de publicar.
- Emblemas das marcas: `tools/ref/brand_badges.py`. Quadro da LP5: `tools/ref/lp5_cluster.py`.

## Mostradores
- Quando a arte do Victor traz os mostradores desenhados, partir dela: manter o fundo, o aro, os
  textos e as cores da arte, apagar só números com erro e ponteiros pintados, e desenhar por cima
  números, marcações e ponteiros no mesmo estilo (cor, grossura, miolo). Comparar lado a lado
  (arte x print do jogo) antes de publicar.
- Melhor caminho (feito no Viper, `tools/ref/viper_gauges.py`): o fundo de cada mostrador vira uma
  imagem na resolução da arte (`faces` em COCKPIT_ART), com números refeitos em fonte grotesca
  negrita no lugar dos errados, e ponteiros `needleFine` (afinados, suavizados, miolo redondo).
  Conferir também em densidade de iPhone (deviceScaleFactor 3).
- Cada carro tem o seu quadro: nunca reaproveitar o estilo de outro. Copiar da arte/foto daquele
  carro: formato e cor dos ponteiros (fino, largo, afinado, com ou sem rabicho, cor), miolo
  (tamanho, cor, capa), fonte dos números (negrita, fina, condensada, itálica, tamanho, cor,
  posição e de quanto em quanto), marcações (grossura, comprimento, intervalos), faixas de cor,
  textos (MPH, km/h, x1000, marca), fundo (cor, textura, aro) e a iluminação noturna (cor da luz
  dos números/ponteiros e do fundo). Na dúvida, perguntar ou pedir foto do quadro real.
