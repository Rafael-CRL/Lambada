# Notas do projeto (para quem for mexer no código)

Contexto e decisões que não aparecem no código. Leia antes de propor mudanças.

## Produto

- **Objetivo:** aprender a ler partitura (clave de sol: notas e ritmo) e achar as notas no braço do violão enquanto lê.
- **Home:** três botões e uma linha discreta "continuar" (leva à próxima lição da trilha, ou à última atividade).
  - **Teoria musical** (primeiro, a porta de entrada): a trilha guiada, sem instrumento.
  - **Pauta**: prática livre (**Leitura** e **Ritmo**).
  - **Violão**: a trilha **Primeira posição** e a prática (**Escala**, **Notas**, **Explorar**; o microfone confere). **Repetição** existe no código, oculta (`hidden`); virou a parte "no tempo" das lições do violão.
- **Cada tópico abre uma lista curta** (nome + uma frase). Clicar = começar.
- **Nenhuma configuração antes de começar.** Os ajustes são ícones no canto inferior direito da atividade, e cada um abre um balão pequeno. Ficam salvos por atividade.
  - Mudam sem reiniciar: som, BPM (Leitura), ♯♭.
  - Reiniciam a sessão sozinhos: tempo livre/metrônomo, figuras, duração, notas; no Ritmo, todos.
- **Um número só na tela** (acerto % ou pontos). O resto fica no resumo, que aparece ao sair com 10 ou mais notas feitas.
- **Som dos botões:** piano por padrão (violão ou mudo como opção), sempre na altura real do violão.
- **Cola das notas:** botão que mostra todas as linhas e espaços até a casa 12, com seta para expandir até a 19.

### Trilhas (`src/lessons/`)

- **Unidade → lições → segmentos** (`curriculum.ts`). Segmento = notas na pauta (`NotesSegment`), ritmo (`RhythmSegment`) ou partitura no tempo (`ScoreSegment`, a Leitura/Notas com metrônomo). Um cartão separa segmentos.
- **Teoria musical, 10 unidades, notas e ritmo intercalados:** Linhas · Pulso e figuras · Espaços · Compasso · Suplementares · Pausas · Colcheias · Ponto de aumento · Leitura de partitura · Acidentes.
- **Violão:** Primeira posição, corda por corda (1ª à 6ª, a ordem dos métodos clássicos) + Desafio. Cada corda: notas pelo microfone (o braço mostra onde fica na apresentação e depois de um erro) e "no tempo" (cada nota repetida por um compasso, com metrônomo).
- **Teoria = cartões de conceito** (`cards.tsx`, desenhos em `art.tsx`): uma frase e um desenho, alguns com "ouvir". Abrem no começo da lição; o "?" reabre. Atividades com cartões (Escala, Ritmo) mostram na primeira vez (`meta.seenCards`).
- **A pauta não tem exercício:** 5 linhas e 4 espaços, linha × espaço, grave/agudo e a clave abrem a 1ª lição de Linhas como cartões. Havia uma unidade inteira perguntando "linha ou espaço" e "qual linha": cortada por treinar o que se vê de relance.
- **A escala dá sentido às linhas:** Linhas 1 diz que agudo = mais alto e que a clave fixa o Sol na 2ª linha; Linhas 2 mostra a escala (Dó…Si, do grave ao agudo) e que de uma linha à outra pula-se uma nota; Espaços 1: os espaços são as notas puladas; Espaços "A escala": linha e espaço se alternam.
- **Lição de notas:** apresenta as notas novas repetidas (nome + cola; em Linhas e Espaços uma vez só, `times: 1`), padrão em ordem (cola fraca), sorteio sem ajuda. Semibreves sem compasso. Errou: mostra o nome e o lugar ("2ª linha"), espera e segue; no sorteio a nota volta 3 notas depois, com a cola acesa só nela.
- **Lição de ritmo** (à la Musicca / Complete Rhythm Trainer): imitar (ouvir e bater), ler (só o metrônomo), escrever (paleta de figuras), "quantos pulsos dura?" e "complete o compasso". Pauta de uma linha. Bate-se no espaço (ou clique/toque); o cartão pede para marcar o pulso com o pé. Um compasso de contagem; a contagem 1 2 3 4 acende sob a pauta. Errou: notas perdidas em vermelho, o app toca o certo e segue; o trecho volta mais adiante.
- **Desafio** (última lição da unidade): sem ajuda; notas: 90% e até 2 s por nota (3 s no violão); ritmo: 90%. Passar no Desafio fecha a unidade (quem já sabe pula as lições). O cartão da unidade mostra o recorde de tempo.
- **Revisão:** 20% do sorteio vem das unidades anteriores (linhas em Espaços, pauta em Suplementares, cordas anteriores no violão). O Mi da 1ª linha e o Mi/Fá de cima são referência: ficam no padrão, fora do sorteio.
- Fim da lição: "próxima", "+ 10" (na mesma tela), "de novo". **Nada bloqueado.** Progresso em `meta.trail`, pelo id da lição; parâmetros em `LESSON` e `RHYTHM` (`src/config.ts`).
- **Ids:** `unidade-N` pela posição. Ao cortar uma lição, as que ficam mantêm o número (`n` em `lessonsOf`) para o progresso guardado continuar valendo: por isso Linhas vai 1, 2, 3, 5 e Espaços 1, 2, 4, 5.

### Regras que valem para o app todo

- **Tempo livre = semibreves sem barras** (não há ritmo, a figura não quer dizer duração). **Metrônomo = figuras e compasso de verdade.**
- **Figuras (nível 1–5) na ordem da trilha:** semínima · + mínima e semibreve · + pausas · + colcheias · + pontuadas.
- **Leitura com botões: errou, mostra a certa e segue.** O violão (Notas) espera a nota certa: tocar a certa é o treino.
- **Leitura, ajuste "Notas":** linhas, espaços, suplementares ou todas (Mi3 a Mi6). É o treino final de cada unidade, sem modo novo.

## Princípios (o usuário insistiu nisso)

- **Sem redundância.** Uma variação vira opção de uma atividade existente (`ACTIVITIES` em `src/exercises/types.ts` + `ControlsDock`), nunca um modo novo. Já foram removidos, por serem redundantes: esteira contínua/espera, sprint, BPM, "No tempo", adaptativo e a tela de opções antes de começar.
- **Pouco texto, revelação gradual.** Se precisa de parágrafo explicando, o desenho está errado.
- **Nada de exercício para o que se vê de relance** ou que foi dito na tela anterior (quantas linhas, qual linha, repetir o nome que está escrito). Isso vira cartão ou animação. O esforço vai para o porquê (clave → escala → notas) e para exercícios que exigem leitura. Facilidade demais parece perda de tempo, não progresso.
- **Nada de bloquear conteúdo.** Gamificar é para acelerar o aprendizado, não para atrapalhar quem já sabe. O desbloqueio progressivo de notas está **desligado**.
- **Região fixa em Solta** (casas 0–3). O ajuste Solta/Fechada foi tirado porque o microfone não distingue a corda, só a altura.
- **Numa tela grande, pauta e botões juntos no meio** (perto do olho e do mouse); no celular, botões no rodapé (`ExerciseBody` em `src/exercises/parts.tsx`).

## Como trabalhar com o usuário

- Português, respostas diretas.
- **Pedido grande ou ambíguo: perguntar antes de construir** (uma rodada de perguntas numeradas com recomendação). Adivinhar causou três redesenhos seguidos. Quando ele dá liberdade, decidir e só perguntar o que for realmente importante.
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
- **Ritmo:** células (`q h w dh ee dqe qr hr wr`) em `src/domain/rhythm.ts`, compassos 2/4, 3/4, 4/4. Batida casa com o ataque livre mais próximo dentro da tolerância (`src/rhythm/judge.ts`); batida a mais desconta.

## Código

- **`src/exercises/score.ts`:** a partitura rolando (Leitura, Notas, Escala e os segmentos "no tempo" das lições): tempo livre ou metrônomo; figuras por nível ou pelas células da lição.
- **`src/lessons/`:** trilhas. `controller.ts` = lição de notas (botões, lugar ou microfone); `LessonScreen` orquestra cartões e segmentos.
- **`src/rhythm/`:** o ritmo. `controller.ts` (itens, linha do tempo, batidas), `RhythmStaff.tsx` (desenho estático, cursor por fora do React), `controls.tsx` (área de bater, paleta).
- **Animação fora do React:** `stage.ts` mexe no SVG por `transform`; o cursor do ritmo também.
  - Relógio único = `AudioContext` (`src/audio/clock.ts`). `clock()` é o tempo que está saindo no alto-falante: som agendado em T soa quando `clock() = T`, e batidas (`clock(event.timeStamp)`) comparam direto.
  - Metrônomo com agendador de lookahead; tons das figuras em `src/audio/tones.ts`.
- **Áudio:** detecção em `src/audio/tracker.ts` (ataque + estabilidade), atrás do adaptador `pitch.ts` (pitchy).
- **Parâmetros ajustáveis:** todos em `src/config.ts`.
- **Armadilha:** o `<svg>` da pauta do exercício recebe a classe `staff` do palco *e* do React. Se o `className` do React mudar sem incluir `staff`, somem as cores das linhas e da clave.
- **Armadilha:** campos de classe inicializados com `this.d` rodam antes do construtor (ES2022); inicialize no construtor.

## Rodar e testar

- `docker compose up` → http://localhost:5173. Nada de Node no host.
- Testes e tipos: `docker compose exec app npx vitest run` e `docker compose exec app npx tsc -b`.
- **Hot reload às vezes perde uma escrita rápida em sequência** e serve versão velha. Conferir com `curl localhost:5173/src/<arquivo>` e, se preciso, `touch` no arquivo. Ele também remonta a tela: um `window.__lambada.controller` guardado antes fica velho.
- **No navegador de automação:**
  - Usar **http://127.0.0.1:5173** (outra origem, outro IndexedDB), para não mexer nos dados reais do usuário em `localhost`. Apagar o banco `lambada` dessa origem ao terminar.
  - Aba nova: o áudio só libera com um clique de verdade (ferramenta de clique, não evento sintético). Se a aba estiver oculta, `requestAnimationFrame` não roda: use `window.__lambada.controller` (só em dev) e `update(...)` na mão.
  - `?fakemic` na URL (antes do `#`) troca o microfone por um violão sintético: `lambadaPluck('E2', atraso)`, com a nota soando.
  - Para testar batidas: agende `keydown ' '` com `setTimeout` para `(instante do ataque − clock()) × 1000` ms; o `tl` do controlador de ritmo tem `base` e os segmentos.

## Para depois (combinado, não fazer sem pedido)

- Revisão espaçada separada (notas e ritmos esquecidos voltando depois de dias).
- Ritmo pelo microfone (palmas ou o violão).
- Região Fechada e regiões maiores do braço; outras escalas (maiores, menores, pentatônicas).
- Semicolcheia, ligadura, tercina, compasso composto (6/8), clave de fá.
- "Achar no braço": clicar a posição da nota da pauta num braço desenhado; "escrever a nota": clicar o lugar na pauta.
