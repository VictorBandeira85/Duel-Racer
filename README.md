# Duel Racer

Jogo de corrida mobile (iOS primeiro) inspirado nos clássicos de duelo dos anos 90:
você contra um rival, em estradas de mão dupla com trânsito, em visual pseudo-3D estilo 16 bits.

Todo o conteúdo (carros, pistas, gráficos e sons) é original e gerado por código: nenhuma marca,
imagem ou som de jogos existentes.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173 (também acessível pelo celular na mesma rede)
npm run build    # gera a versão final em dist/
```

Controles no computador: setas (ou WASD) para acelerar, frear e virar; `Q`/`E` trocam a marcha no câmbio manual.
No celular: botões na tela (jogue com o aparelho na horizontal).

## O que já existe (v0.1)

- Motor de estrada pseudo-3D com curvas, subidas e descidas
- 4 pistas: Costa do Sol, Deserto Vermelho, Serra Nevada, Neon Noturno
- 3 carros fictícios com velocidade, aceleração e controle diferentes
- Câmbio automático ou manual (5 marchas)
- Rival com IA que desvia do trânsito
- Trânsito nos dois sentidos, batidas e perda de velocidade fora da pista
- Som do motor sintetizado, recordes salvos no aparelho

## Próximos passos

- Polícia com radar e perseguição
- Modo campeonato (sequência de pistas, dinheiro, garagem e melhorias)
- Mais carros, pistas e rivais com personalidades diferentes
- Clima (chuva, neblina) e ciclo dia/noite
- Trilha sonora
- Empacotamento iOS com Capacitor e build na nuvem para TestFlight

## Estrutura

| Arquivo | Função |
|---|---|
| `src/track.ts` | Gera as pistas (curvas, morros, cenário) a partir de uma semente |
| `src/stages.ts` | Definição das pistas: cores, cenário, quantidade de trânsito |
| `src/cars.ts` | Carros e como são desenhados |
| `src/game.ts` | Física, câmbio, IA do rival, trânsito e colisões |
| `src/render.ts` | Renderização pseudo-3D e painel (HUD) |
| `src/sprites.ts` | Objetos de cenário |
| `src/input.ts` / `src/audio.ts` | Controles e som |
