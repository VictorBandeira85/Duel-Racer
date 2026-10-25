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
