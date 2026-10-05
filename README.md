# Lambada

Exercícios de leitura de partitura e de localização das notas no braço do violão clássico, com retorno pelo microfone.

**Demo:** https://rafael-crl.github.io/Lambada/

## O que tem

- **Violão:** trilha Primeira posição, corda por corda, e as atividades Notas (ler a nota na pauta e tocar), Escala (as naturais na primeira posição) e Explorar (tocar ou clicar no braço e ver a nota). O microfone confere a nota, na oitava certa, e o tempo.
- **Praticar:** Leitura (ler a nota e responder) e Ritmo (ler e bater), em tempo livre ou com metrônomo.
- **Teoria musical:** trilha guiada do zero (notas na pauta, figuras, compasso, pausas, acidentes) com cartões, guias e desafios.
- **Progresso:** acerto por nota, na pauta e no braço, e histórico das sessões.
- **Estudo guiado:** exercícios das páginas 26–34 de *Iniciação ao violão*, de Henrique Pinto, até Andante e Poco Andante (2/4 e 3/4). Escolha direta, partituras fixas, BPM, escuta e voltas. Exercícios de uma voz têm correção pelo microfone; arpejos e peças têm prática com metrônomo.

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

- [VISAO.md](VISAO.md): para onde o app pretende seguir.
- [NOTAS-DO-PROJETO.md](NOTAS-DO-PROJETO.md): decisões e armadilhas do código.

[pitchy]: https://github.com/ianprime0509/pitchy

Veja os [resultados dos testes de detecção de áudio](docs/deteccao/historico/RESULTADOS.md), com gráficos e comparações por rodada.
