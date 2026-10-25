# Duel Racer

Jogo de corrida mobile (iOS primeiro) inspirado em **Test Drive II: The Duel** (SNES):
visão de dentro do carro, duelo contra um rival por estradas de mão dupla, polícia com radar
e trechos que terminam em postos de gasolina.

Carros, marcas, gráficos e sons são originais e gerados por código: nada é copiado do jogo original.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173 (também acessível pelo celular na mesma rede)
npm run build    # gera a versão final em dist/
```

Controles no computador: setas para acelerar, frear e virar; `Q`/`E` trocam a marcha no câmbio manual;
`Esc` pausa. Nos menus: setas + `Enter`. No celular: toque (jogue com o aparelho na horizontal).

## O que já existe (v0.2)

- Visão da cabine: volante, conta-giros, velocímetro, câmbio em H, detector de radar e retrovisor
- Painel diferente conforme o carro
- Menu com placas de rodovia, ficha técnica do carro com gráfico de aceleração,
  escolha do adversário (3 carros ou contra o relógio) e mapa dos percursos
- 4 percursos (Fácil, Médio, Difícil, Expert) com 5 trechos cada: floresta, fazenda, deserto,
  cidade, serra, neve e litoral, com noite, chuva e neve
- Posto de gasolina ao fim de cada trecho, vidas ("carros restantes") e carro bônus por trecho limpo
- Polícia escondida que persegue quem passa rápido; se alcançar, multa (+10 s)
- Batida trinca o para-brisa e custa um carro
- 8 carros com marcas fictícias, baseados em superesportivos reais do começo dos anos 90
  (silhueta, traseira e ficha técnica de cada modelo), câmbio automático ou manual, recordes salvos no aparelho

## Próximos passos

- Ajustar dificuldade e controles jogando no iPhone
- Trilha sonora e mais efeitos sonoros
- Mais carros, percursos e rivais
- Empacotamento iOS com Capacitor e build na nuvem para TestFlight

## Estrutura

| Arquivo | Função |
|---|---|
| `src/main.ts` | Liga tudo: telas, corrida, laço principal |
| `src/screens.ts` | Menus, posto de gasolina, resultados e recordes |
| `src/race.ts` | Física, câmbio, rival, trânsito, polícia, batidas |
| `src/cockpit.ts` | Painel, volante, retrovisor, para-brisa trincado, chuva/neve |
| `src/render3d.ts` | Estrada pseudo-3D e retrovisor |
| `src/track.ts` | Gera cada trecho (curvas, morros, cenário, polícia) |
| `src/courses.ts` / `src/themes.ts` | Percursos, trechos e visual de cada ambiente |
| `src/cars.ts` | Carros, ficha técnica e desenho |
| `src/sprites.ts` | Objetos de cenário |
| `src/input.ts` / `src/audio.ts` | Controles e som (motor, sirene, batida) |

## Ferramentas de referência visual

Para aproximar o visual do jogo original, as capturas de referência são medidas em vez de
comparadas "no olho". As capturas do jogo original servem só como medida: nunca entram no jogo
nem no repositório (a pasta `refs/` é ignorada pelo git).

```bash
# 1. mede uma captura: recorta a área do jogo, reconstrói os pixels nativos (256x224),
#    extrai a paleta e gera uma ampliação com grade de coordenadas
python3 tools/ref/measure.py refs/captura.png refs/medida-f40

# 2. captura o quadro do jogo em 256x224 (com `npm run dev` rodando)
node tools/ref/capture.cjs refs/jogo-f40.png <carro> <percurso> <trecho>

# 3. compara: lado a lado, sobreposição e mapa de diferenças, com a diferença média por região
cd tools/ref && python3 compare.py ../../refs/medida-f40/native.png ../../refs/jogo-f40.png ../../refs/comparacao.png
```

A corrida é desenhada em 256x224 (resolução do Super Nintendo) com pixel 8:7, como na TV; em
telas largas, a área de 256 px fica no centro e teto/painel se estendem para os lados.
