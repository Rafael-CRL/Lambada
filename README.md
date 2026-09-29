# Lambada

Leitura de partitura e prática de violão clássico, com retorno em tempo real pelo microfone.

Você lê a nota na pauta, toca no violão e o app ouve e responde na hora: no braço, na pauta e no tempo.

## O que tem

- **Teoria musical:** trilha guiada do zero (notas na pauta, figuras, compasso, pausas, acidentes) com cartões, guias e desafios.
- **Praticar:** leitura de notas e ritmo com metrônomo.
- **Violão:** primeira posição, corda por corda. O microfone confere a nota (na oitava certa) e o tempo.

O microfone avalia altura e tempo. Dedilhado, corda e qualidade do som, não, e o app não finge que avalia.

## Por dentro

- **Detecção de notas** (`src/audio/tracker.ts`): ataque, estabilidade e fim da nota sobre o detector de altura [pitchy].
- **Um relógio só** (`src/audio/clock.ts`): som, animação, metrônomo e microfone no tempo do `AudioContext`, compensando a latência de saída.
- **Sorteio de notas** (`src/engine/picker.ts`): cada nota uma vez por rodada, reforço das erradas, nunca a mesma seguida.
- **Pauta em SVG** animada fora do React, direto no `transform`.

React 19, TypeScript, Vite, Tailwind, Dexie (IndexedDB) e Vitest.

## Rodar

```sh
docker compose up
```

Abra http://localhost:5173. Se o `package.json` mudar: `docker compose up --build`.

Testes: `docker compose exec app npx vitest run`.

## Mais

- [VISAO.md](VISAO.md): para onde o produto vai e por quê.
- [NOTAS-DO-PROJETO.md](NOTAS-DO-PROJETO.md): decisões e armadilhas do código.

[pitchy]: https://github.com/ianprime0509/pitchy
