# Duel Racer — regras de trabalho

- Falar com o Victor em português, de forma concisa.
- Estilo: pixel art, nada irreal, sons sem agudos demais, interface de revista de carros dos anos 90,
  vidros dos carros sempre cor de vidro. Só marcas e logos fictícias (src/assets/brands.json).

## Escopo
- **Só mexer nos carros que o Victor já mandou atualizados**: Toro V12 (Diablo) e a viatura SV,
  Fúria TR, Fúria F4, Kaze NX, Serpe V10, Gaúcho GTI, Ímola S/R (hatch), Ímola Classic Coupé, Jornada LS
  Jornada Sport (Voyage Sport 1992: voyagesport_*.py) e Savana GLS (Santana GLS 1990: santana_*.py;
  depois do santana_sprites.py rodar santana_rear_panel.py e santana_side_lamp.py)
  (Voyage LS 1986: voyage_sprites.py, voyage_cockpit.py, voyage_gauges.py, voyage_photos.py). O Ímola de
  quatro portas saiu do jogo (a cabine do cupê continua nos arquivos br-monzasedan-*).
  O Silber 95 (959) está atualizado: exterior, capas e cabine completa (painel da arte sem volante,
  volante da arte com volante; tools/ref/silber_cockpit.py e silber_gauges.py). O Toro LP5 (Countach 5000 QV) está atualizado: exterior novo (tools/ref/countach_sprites.py, frente com
  faróis escamoteáveis em countach-front-up), cabine (lp5_cockpit.py: painel da arte sem volante, volante da com volante) e
  quadro das fotos reais (lp5_cluster.py, aceso em verde à noite). Passeio GTS (Passat): cabine nova (tools/ref/passat_cockpit2.py:
  painel da arte sem volante, volante da com volante, emblema da Ipê) com o quadro do Savana GLS por decisão do Victor
  (passatPlate em cockpit.ts); exterior novo (tools/ref/passat_sprites2.py: arte de cenário,
  frente vermelha convertida para o prata da lateral pelo brilho); as capas seguem à parte. Os demais (ZR1, Patrol, Vectra, Kadett, Corsa, Uno, Pumas) ficam como estão
  até a arte nova chegar, para não haver retrabalho: nada de retoques, retrovisores ou quadros neles.
  Na dúvida, perguntar.

## Publicação
- A cada rodada: só a versão web/mobile (artifact), commit e push em `main`.
  Carro novo: publicar cada parte assim que ficar pronta e conferida (exterior e capas primeiro, a
  cabine depois), sem esperar o carro inteiro (pedido do Victor: estava demorando). Subir a versão em
  `package.json` (e `desktop/package.json`) ANTES do build.
- Publicação (desde a v0.34.1): a página leva só o código e as imagens pequenas; as imagens acima de
  32 KB vão como arquivos de apoio do artifact (limite de 16 MB por arquivo, 256 MB no total).
  1. `npm run build:artifact`
  2. `node tools/to-artifact.mjs <scratchpad>/af/duel-racer.html --files` (copia para `af/files/` e grava
     `af/changed.json` com os arquivos que mudaram desde a última publicação)
  3. publicar `af/duel-racer.html` no mesmo artifact com `root: af/files` e `files` = só os de
     `changed.json` (os outros continuam lá; `gone` vai com `null`); no máximo 255 por publicação
  4. `node tools/to-artifact.mjs <scratchpad>/af/duel-racer.html --done` (registra o que foi publicado)
  Se `af/published.json` não existir (sessão nova), `changed.json` lista tudo: publicar todos.
  Antes de publicar mudança no build, testar como o artifact roda de verdade: página dentro de um
  `<iframe sandbox="allow-scripts">` com `<base>` apontando para `af/files` (servidor com CORS). Servir
  na mesma origem NÃO pega canvas "sujo" (getImageData falhando = carros em desenho de reserva); por
  isso o to-artifact entrega toda imagem de arquivo como data: (fetch), nunca direto no `src`.
- Fase de testes: `TEST_MONEY` (career.ts) dá saldo mínimo de $1.000.000 em toda carreira. Manter nas
  builds até o Victor mandar tirar (pôr 0).
- Versão de PC (`npm run desktop`, instalador e zip) e APK **só quando o Victor mandar, a cada vez**
  (pedido de 12/11: nada de gerar por conta própria, nem "por garantia" antes do fim da sessão).
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
- Quando o Victor manda a **foto do quadro real**, ela manda: montar a comparação foto x print do jogo
  (um em cima do outro, mesmo tamanho) e só publicar quando baterem a forma dos mostradores (redondos,
  cortados, em painel), o lado do pivô e do arco de cada mostrador pequeno, a posição dos números em
  relação às marcações, o formato do ponteiro (barra ou afinado: `needleTip`) e as luzes-espia.
  Quadros só ficam parecidos entre carros que usam o mesmo quadro de verdade (Ímola hatch/sedã/cupê;
  Passeio GTS usa o quadro do Savana GLS por decisão do Victor).
- Ponteiros: conferir parado e acelerando (print dos dois). O conta-giros mostra o giro de verdade na
  escala do mostrador (`tachReal`), o velocímetro descansa onde o real descansa (`speedRest`), e o
  formato vem da foto. **Olhar o centro do ponteiro na foto ampliada**: na Fúria TR a barra atravessa o
  eixo (rabicho comprido, sem miolo); no GTI e no Ímola há um disco chapado EMBAIXO e a barra passa por
  cima dele (`hubUnder`); só usar miolo em cima (bola com brilho) quando a foto mostrar uma capa.
- Limpadores de para-brisa desenhados na arte SAEM (para-brisa limpo): os limpadores são do jogo, na chuva.
- Quadro aceso à noite (Jornada LS): fundo verde-garrafa escuro e pouco saturado, números e marcações
  claros por cima; nunca verde vivo chapado (apaga os algarismos). Conferir a leitura em tamanho de celular.
  Savana GLS: o aceso é verde-AMARELADO (oliva), como nas fotos do Santana, com números lima claros.
- Luzes-espia nunca ficam acesas na arte: desenhar apagadas e acender no jogo na hora certa (óleo,
  freio de mão, pisca). Faixas de cor seguem a lógica do ponteiro (econômetro: verde onde ele fica com
  o pé leve).

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

- **Sprites com cara de 16 bits (referência: Viper e NSX)**: nunca reduzir a arte por área (borra e
  mistura tons). Se a arte tem grade nativa, `tools/ref/regrid.py`; se não tem (grade irregular),
  `shrink` de `tools/ref/monza_sprites.py`: cor do miolo de cada bloco + paleta curta, em tamanho maior
  (lateral 400, frente/traseira 260). Comparar lado a lado com o Viper antes de publicar.

## Rodas, troca de carro e preparação
- Rodas da lateral (`WHEELS` em cars.ts): sempre medir com `python3 tools/qa/wheel_fit.py <arte>` e
  conferir com `--sheet` (roda girada em 4 ângulos); o raio é o do aro, não o do pneu.
- Troca de carro animada: `src/carswap.ts` (`carSwap(slot, carro, t)` dentro da foto). Tela nova com
  foto de carro trocável deve usar.
- Preparação (peças): catálogo em `src/tuning.ts` (vagas, peças, custo, efeito na ficha, no ronco via
  `soundMods` e na altura via `rideDrop`). Peça nova = uma linha no catálogo; a tela (drawPrep em
  careerScreens.ts), o save (`builds`/`parts`) e a física já leem de lá.
- Catálogo de preparação fora da carreira (`openPrepDemo`, tela `prepDemo`, `ui.demo` em careerScreens.ts):
  a mesma tela da oficina com qualquer carro do showroom, sem comprar (mostra preço, ficha, lateral e
  ronco). Entradas: toque nas capas de peças ('pc') e botão PREPARAÇÃO do anúncio no showroom.
- Vagas que dependem da indução (`slotsFor(car, build)`): turbo libera turbina, intercooler e downpipe;
  supercharger libera polia e intercooler. Só instalam com o turbo/supercharger já instalado.
  A tela de preparação mostra só a lateral, grande; a ilustração da peça fica na barra da vaga.
- Roda com vão cinzento na arte: `python3 tools/ref/wheel_dark_windows.py <roda> x,y ...` (pinta de preto).
- Manômetro auxiliar (turbo/supercharger da preparação): `pod` em COCKPIT_ART (centro, raio, cor do
  fundo, do aro e da luz, variando de carro para carro), desenhado por `auxPods` (cockpit.ts) conforme
  `car.pods` (applyBuild): pressão do turbo/compressor, de óleo (pistões e bielas preparados) e de
  combustível (alimentação preparada), lado a lado. Conferir com `FORCED=turbo node tools/qa/cockpit_shots.cjs <pasta> <id>`: copo apoiado no
  painel, sem tapar radar, retrovisor nem quadro. Sem marca real no mostrador.
  Se o painel do carro não tiver um lugar bom, os relógios vão na coluna da porta: `pillar: '<cor>'` no
  `pod` desenha um suporte moldado preso à coluna (sem copo nem pé), com `dx`/`dy` seguindo a inclinação.
  **Medir a coluna na arte** (colunas opacas do friso interno em cada linha do topo; x do pod = coluna
  - 102, y = linha - 76): rente ao friso escuro, nunca na moldura da porta nem flutuando no vidro.
- Som do turbo/supercharger da preparação (audio.ts): `spool` (assobio + sopro + alívio, mais grave e
  forte com turbina maior) e `blower` (zunido preso ao giro) em `soundMods`; valem para qualquer carro
  e têm de aparecer por cima de motor alto (V12).
- Rodas aftermarket: `tools/ref/wheels_sheet.py <folha> src/assets/wheels` recorta a folha (lista KEEP: uma
  de cada desenho, as repetidas ficam de fora); o catálogo é `WHEEL_LIST` em tuning.ts e o desenho no
  carro é `drawRims` (cars.ts), no centro e raio de `WHEELS`.
- Rebaixamento (`rideDrop`, drawCarSide): rodas no lugar + carroceria descida com furo no pneu + sombra
  da caixa de roda. Depois de mexer nisso ou nas rodas, conferir todos os carros com
  `node tools/qa/lowered_shots.cjs <pasta>` (original, esportiva e de corrida): pneu redondo e no chão.

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
- Máscara feita só pela cor "cheia" deixa de fora o contorno escuro e os reflexos da lataria: com outra
  cor sobram pixels da cor de fábrica nas bordas (Kaze NX). Conferir com `python3 tools/qa/paint_leftover.py
  <prefixo> <saída.png>` (pinta de branco e marca os restos) e corrigir como `tools/ref/nx_paint_edges.py`.
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
- Faixa à esquerda da arte ESPELHADA (porta em "V" simétrico, pé do retrovisor duplicado): refazer como no
  Serpe V10 (`tools/ref/viper_door_fix.py`): moldura do retrovisor inteira com um pé só, vão sob o pé vira
  vidro, e a porta continua cada linha da arte descendo em curva até a borda.
- Desempenho à noite: medir com `node tools/qa/draw_cost.cjs <carro> <pista...>` (chamadas, megapixels e
  trocas de canvas por quadro, dia x noite). Efeito novo de luz não pode usar um rascunho por objeto:
  desenhar em lote (atlas, varredura do longe para o perto) como em shadeCars/maskedPools.
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
