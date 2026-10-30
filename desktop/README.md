# Duel Racer para computador

O jogo é o mesmo do site (pasta `src/` do projeto); esta pasta só o empacota como programa de
computador com o [Electron](https://www.electronjs.org/).

## Gerar os executáveis do Windows

Na raiz do projeto:

```
npm run desktop
```

Isso compila o jogo, copia para `desktop/app/` e gera em `desktop/release/`:

- `DuelRacer-<versão>-portatil.exe` — roda direto, sem instalar;
- `Duel Racer Setup <versão>.exe` — instalador (atalho no menu Iniciar e na área de trabalho).

No Linux é preciso o Wine instalado (o empacotador grava o ícone e o nome no .exe com ele).
Mac: `cd desktop && npx electron-builder --mac` (precisa ser feito num Mac).

## Versão

O número aparece no canto da capa e no painel de pausa. Para uma versão nova de teste, aumente
`version` no `package.json` da raiz e no deste (os dois iguais).
