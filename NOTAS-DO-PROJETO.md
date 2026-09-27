# Notas do projeto (para quem for mexer no código)

Contexto e decisões que não aparecem no código. Leia antes de propor mudanças.

## Produto

- **Objetivo:** aprender a ler a pauta (clave de sol) e achar as notas no braço do violão enquanto lê.
- **Home:** só dois botões, **Pauta** e **Violão**, e uma linha discreta "continuar".
- **Cada tópico abre uma lista curta de atividades** (nome + uma frase). Clicar = começar.
  - Pauta: a **trilha** (Linhas, Espaços, Suplementares; 5 lições cada) e depois a **Leitura** (responde com botões ou teclado).
  - Violão: **Escala**, **Notas**, **Explorar** (o microfone confere). **Repetição** existe no código, mas está oculta (`hidden`).
- **Nenhuma configuração antes de começar.** Os ajustes são ícones no canto inferior direito da atividade, e cada um abre um balão pequeno. Ficam salvos por atividade.
  - Mudam sem reiniciar: som, BPM, ♯♭.
  - Reiniciam a sessão sozinhos: tempo livre/metrônomo, figuras, duração.
- **Um número só na tela** (acerto % ou pontos). O resto fica no resumo, que aparece ao sair com 10 ou mais notas feitas.
- **Som dos botões:** piano por padrão (violão ou mudo como opção), sempre na altura real do violão.
- **Cola das notas:** botão que mostra todas as linhas e espaços até a casa 12, com seta para expandir até a 19.

- **Trilha da Pauta** (`src/lessons/`): aprender por tentativa e erro.
  - Lições 1–4: apresenta as notas novas repetidas (nome + cola), padrão em ordem (cola fraca), sorteio sem ajuda. Um cartão entre as partes espera qualquer tecla.
  - Lição 5 = **Desafio**: 20 notas sem ajuda; passa com 90% e até 2 s por nota. Passar no Desafio fecha a etapa (quem já sabe pula as lições). O cartão da etapa mostra o recorde de tempo.
  - Semibreves sem compasso. Errou: mostra o nome e o lugar ("2ª linha"), espera um pouco e segue. No sorteio, a nota errada volta 3 notas depois, com a cola acesa só nela.
  - O sorteio revisa as etapas anteriores (20%: linhas em Espaços, pauta em Suplementares). O Mi da 1ª linha e o Mi/Fá de cima são referência: ficam no padrão, fora do sorteio.
  - Fim da lição: "próxima", "+ 10 notas" (treino extra na mesma tela), "de novo". Nada bloqueado. Progresso em `meta.trail`; parâmetros em `LESSON` (`src/config.ts`).

## Princípios (o usuário insistiu nisso)

- **Sem redundância.** Uma variação vira opção de uma atividade existente (`ACTIVITIES` em `src/exercises/types.ts` + `ControlsDock`), nunca um modo novo. Já foram removidos, por serem redundantes: esteira contínua/espera, sprint, BPM, "No tempo", adaptativo e a tela de opções antes de começar.
- **Pouco texto, revelação gradual.** Se precisa de parágrafo explicando, o desenho está errado.
- **Nada de bloquear conteúdo.** Gamificar é para acelerar o aprendizado, não para atrapalhar quem já sabe. O desbloqueio progressivo de notas está **desligado**.
- **Região fixa em Solta** (casas 0–3). O ajuste Solta/Fechada foi tirado porque o microfone não distingue a corda, só a altura. Volta junto com a futura trilha de iniciante.

## Como trabalhar com o usuário

- Português, respostas diretas.
- **Pedido grande ou ambíguo: perguntar antes de construir** (uma rodada de perguntas numeradas com recomendação). Adivinhar causou três redesenhos seguidos.
- Commit só quando pedido. O primeiro commit está sem linha de coautor, a pedido dele.
- **Antes de chamar algo de bug, olhar os dados reais.** O caso do "erro de oitava" era leitura: Sol5 (acima da pauta) ≠ Sol4 (2ª linha, 3ª corda solta). O IndexedDB do usuário em `localhost:5173` mostrou isso.

## Domínio (o que confunde)

- **Violão é transpositor:** escrito = soando + 1 oitava. O microfone entrega o MIDI soando e o controlador soma 12 antes de comparar.
- **Microfone:** oitava exata é obrigatória; qualquer enarmônico conta. Com botões só a grafia exata conta e a oitava não importa.
- **Braço:** 6 cordas × casas 0–12 (até 19 na cola), afinação padrão. Tudo derivado de `STANDARD_TUNING`.
- **Sorteio (Leitura e Notas):** `src/engine/picker.ts`.
  - Saco embaralhado: cada nota sai uma vez por rodada.
  - 3 de cada 10 posições reforçam notas com erro recente (no máximo 1 por nota por bloco).
  - Nunca a mesma nota duas vezes seguidas.
  - Só erro pesa; tempo de resposta não.
  - Parâmetros em `PICKER` no `src/config.ts`.

## Código

- **`src/exercises/score.ts`:** controlador único. Faz a partitura em compassos 4/4, tempo livre ou metrônomo, e as figuras por nível (`src/domain/rhythm.ts`).
- **Animação fora do React:** `stage.ts` mexe no SVG por `transform`.
  - Relógio único = `AudioContext` (`src/audio/clock.ts`).
  - Metrônomo com agendador de lookahead.
- **Áudio:** detecção em `src/audio/tracker.ts` (ataque + estabilidade), atrás do adaptador `pitch.ts` (pitchy).
- **Parâmetros ajustáveis:** todos em `src/config.ts`.
- **Armadilha:** o `<svg>` da pauta do exercício recebe a classe `staff` do palco *e* do React. Se o `className` do React mudar sem incluir `staff`, somem as cores das linhas e da clave.

## Rodar e testar

- `docker compose up` → http://localhost:5173. Nada de Node no host.
- Testes e tipos: `docker compose exec app npx vitest run` e `docker compose exec app npx tsc -b`.
- **Hot reload às vezes perde uma escrita rápida em sequência** e serve versão velha. Conferir com `curl localhost:5173/src/<arquivo>` e, se preciso, `touch` no arquivo.
- **No navegador de automação:**
  - Usar **http://127.0.0.1:5173** (outra origem, outro IndexedDB), para não mexer nos dados reais do usuário em `localhost`. Apagar o banco `lambada` dessa origem ao terminar.
  - A aba fica "oculta": `requestAnimationFrame` não roda e o `AudioContext` fica suspenso. Use `window.__lambada.controller` (só em dev): `start()`, `loop.stop()` e `update(now, dt)` na mão.
  - `?fakemic` na URL (antes do `#`) troca o microfone por um violão sintético: `lambadaPluck('E2', atraso)`, com a nota soando.

## Para depois (combinado, não fazer sem pedido)

- Trilha de iniciante: Repetição, região Fechada, desbloqueio progressivo.
- Guia básico de teoria (figuras, tempo), ligado às atividades.
- "Achar no braço": clicar a posição da nota da pauta num braço desenhado.
- Outras escalas (maiores, menores, pentatônicas) e regiões maiores do braço.
- Trilha: variação nos padrões (saltos, ex.: Mi→Si, Sol→Ré) para não depender da ordem.
