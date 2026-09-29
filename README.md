# Lambada

Exercícios de leitura de partitura e de localização das notas no braço do violão clássico, com retorno pelo microfone.

**Demo:** https://rafael-crl.github.io/Lambada/

## O que tem

- **Violão:** trilha Primeira posição, corda por corda, e as atividades Notas (ler a nota na pauta e tocar), Escala (as naturais na primeira posição) e Explorar (tocar ou clicar no braço e ver a nota). O microfone confere a nota, na oitava certa, e o tempo.
- **Praticar:** Leitura (ler a nota e responder) e Ritmo (ler e bater), em tempo livre ou com metrônomo.
- **Teoria musical:** trilha para quem começa do zero, com notas na pauta, figuras, compasso, pausas e acidentes.
- **Progresso:** acerto por nota, na pauta e no braço, e histórico das sessões.

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

- [VISAO.md](VISAO.md): para onde o app pretende seguir.
- [NOTAS-DO-PROJETO.md](NOTAS-DO-PROJETO.md): decisões e armadilhas do código.

[pitchy]: https://github.com/ianprime0509/pitchy