# Duel Racer — regras de trabalho

- Falar com o Victor em português, de forma concisa.
- Estilo: pixel art, nada irreal, sons sem agudos demais, interface de revista de carros dos anos 90,
  vidros dos carros sempre cor de vidro. Só marcas e logos fictícias (src/assets/brands.json).

## Escopo
- **Só mexer nos carros que o Victor já mandou atualizados**: Toro V12 (Diablo) e a viatura SV,
  Fúria TR, Fúria F4, Kaze NX, Serpe V10, Gaúcho GTI, Ímola S/R (hatch), Ímola Classic SE (sedã) e Ímola Classic Coupé.
  Os demais (Toro LP5, 959, ZR1, Patrol, Vectra, Kadett, Corsa, Uno, Passat, Pumas) ficam como estão
  até a arte nova chegar, para não haver retrabalho: nada de retoques, retrovisores ou quadros neles.
  O LP5 tem fotos de revista, mas o carro ainda não foi atualizado. Na dúvida, perguntar.

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

## Capas da revista (fotos)
- Toda foto de capa (`src/photos.ts`) leva `box: [x0, y0, x1, y1]` em pixels da foto de 560 x 315:
  a caixa do carro inteiro (para-choque a para-choque, teto ao chão; nas fotos sem carro, o assunto).
  `drawPhoto`/`photoFrame` enquadram sozinhos: carro inteiro e centrado acima da faixa vermelha, em
  qualquer tamanho de quadro (capa do menu e carregamento); se não couber, a foto diminui e os lados
  ficam com a própria foto desfocada. Nunca usar foco fixo.
- Ao adicionar fotos, conferir todas as capas novas com print (`node tools/covers_check.cjs <pasta>`, com o vite rodando) antes de publicar.

## Carros novos
- A vista lateral de todo carro fica com a **frente para a esquerda** (como os demais). Se a arte vier
  virada para a direita, espelhar a lateral e a máscara e espelhar as rodas em `WHEELS` (x -> 1 - x).

- Arte que vem com cenário (não recortada): seguir `tools/ref/monza_sprites.py` (fundo inundado a partir
  das bordas, o contorno preto do carro segura; sombra e asfalto de baixo saem por geometria) e
  `tools/ref/monza_cockpit.py` (vidros por geometria medida, retrovisor completado, porta construída,
  forro no alto). Paisagem vista pelos vidros do sprite vira cor de vidro.
- Arte em fundo preto ou céu liso: `tools/ref/monzasedan_sprites.py` (contorno fechado linha a linha,
  sombra de baixo sai por geometria, lateral de outra cor convertida pelo brilho) e
  `tools/ref/monzasedan_cockpit.py` (vidros pela cor do céu).

## Trânsito
- Cada modelo do trânsito (`tools/art/traffic.py`, `src/assets/traffic`) segue um carro real dos anos 90
  (formas e luzes, sem marca): sedan = Monza, hatch = Gol quadrado, pickup = F-1000, van = Econoline,
  truck = cara-chata LP 1113, fusca, kombi, suv = Explorer, sedan90 = Taurus. Modelo novo: escolher um
  carro real, desenhar traseira e frente, e medir a placa nos PNG (`TRAFFIC_PLATE`/`TRAFFIC_GLOW` em cars.ts).
  A viatura (police-*.png) foi retocada à mão: não sobrescrever ao rodar o script.

## Conferência antes de publicar (obrigatória em arte nova ou mexida)
1. `python3 tools/qa/art_lint.py [carro]`: furos transparentes na cabine, bordas esticadas, máscara de
   pintura pegando lanterna/pisca e reflexos fora da máscara. Furos pequenos: `--fill <cabine>`.
2. `node tools/qa/cockpit_shots.cjs <pasta> <id>` + `python3 tools/qa/sheet.py <pasta>` (vite rodando):
   folha com dia, noite e volante virado, em tela larga (1000x400) e de celular (932x430), com o canto
   esquerdo (retrovisor/coluna) e o quadro ampliados. Olhar a folha inteira, não só o que mudou.
3. Rival/trânsito/física: testar com script que mede posição e velocidade (ex.: rival parando no posto).
4. Depois de mexer em `src/*.ts`, se o teste der igual ao anterior, reiniciar o vite (cache).

## Lições (erros que já aconteceram — não repetir)
- Recorte de cabine: tons azulados/cinzentos de peças (molduras, colunas, borracha) passam por vidro;
  marcar as peças à mão (polígono ou varredura por linha a partir do friso) em vez de confiar só na cor.
- Janela da porta: só até a borda do retrovisor; base do retrovisor e coluna ficam sólidas.
- Telas largas: à esquerda/direita da arte nada pode ser esticado; continuar a textura seguindo a
  diagonal da peça (forro da porta do GTI) e o vidro do retrovisor até a borda (toEdge + edgeFill).
- Máscara de pintura: excluir lanternas, piscas, frisos e letreiros; incluir reflexos claros e bordas
  da cor da lataria (senão ficam rosados/vermelhos com outra cor). Conferir repintando de azul.
- Arte que vem com uma cor diferente da de fábrica numa vista: converter pelo brilho da outra vista.
- Quadro de instrumentos: medir os ângulos de início/fim das escalas na foto; números grandes e
  negritos; nada de texto improvisado no lugar de ícone (desenhar o pictograma).
- Textura de chão/asfalto: nada de grão forte (pisca com o movimento); variação só em faixas.
- Teto: se a arte corta no alto, desenhar o forro e continuar as colunas até ele.
- **Portas e laterais da cabine NUNCA são espelhadas nem esticadas**: são construídas até a borda da
  tela, continuando cada linha da peça (soleira, apoio de braço, frisos, borracha da janela) na própria
  inclinação, com a cor da peça e sem copiar maçanetas/saídas de ar/retrovisores. Ferramenta:
  `python3 tools/qa/edge_build.py <cabine> <L|R> <c0> <inclinação>` (inclinação positiva = a linha desce
  indo para a borda; medir na arte, a automática erra). Ela só refaz as linhas esticadas: retrovisor e
  janela ficam. Conferir com `WIDE=1400 DAYONLY=1 node tools/qa/cockpit_shots.cjs <pasta>` (todos os carros).
- Todo carro tem retrovisor do lado do motorista funcionando (vidro com a vista de trás). Se a arte
  não tem, desenhar com `python3 tools/qa/add_mirror.py <cabine> x0 y0 x1 y1 braço_x braço_y #cor` e pôr
  a semente em `glass.at`. Mão inglesa (NSX): o do motorista é o da direita.
- Retrovisor cortado pela borda esquerda da arte (aparece sem moldura no celular): completar o próprio
  desenho com `python3 tools/qa/mirror_complete.py flip|shift ...` (moldura direita refletida vira a
  esquerda, ou a moldura rente à borda anda para dentro) e acertar `glass.at`; só se não houver espaço
  (959), desenhar com add_mirror.py.
- Fonte dos números do quadro: se nenhuma fonte instalada tem o desenho do carro (ex.: algarismos
  quadrados da VW no GTI), desenhar os algarismos à mão em traço (`SQ` em `gol_gauges.py`) em vez de
  usar uma grotesca parecida.
