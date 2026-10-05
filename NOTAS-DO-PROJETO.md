# Notas do projeto (para quem for mexer no código)

Contexto e decisões que não aparecem no código. Leia antes de propor mudanças. Para onde o produto vai (prática de técnica de violão clássico em partitura, com retorno em tempo real): [VISAO.md](VISAO.md).

## Produto

- **Objetivo:** aprender a ler partitura (clave de sol: notas e ritmo) e achar as notas no braço do violão enquanto lê.
- **Home:** quatro botões e uma linha discreta "continuar" (leva à próxima lição da trilha, à última atividade ou ao último estudo guiado).
  - **Teoria musical** (primeiro, a porta de entrada): a trilha guiada, sem instrumento.
  - **Praticar** (id `pauta` no código): prática livre (**Leitura** e **Ritmo**). Chamava "Pauta", que parecia assunto e não lugar de treinar. A lista da Teoria tem uma faixa fixa apontando para cá: o aluno não precisa voltar às lições para treinar.
  - **Violão**: a trilha **Primeira posição** e a prática (**Escala**, **Notas**, **Explorar**; o microfone confere). Notas tem o ajuste **Cordas** (uma, várias ou todas): o exercício de uma corda fora da lição, sem passar pela teoria de novo. **Repetição** existe no código, oculta (`hidden`); virou a parte "no tempo" das lições do violão.
  - **Estudo guiado** (`#/estudos`): 49 práticas das páginas 26–34 do livro *Iniciação ao violão*, Henrique Pinto (24–32 do PDF consultado). Cordas graves → arpejos → agudas → alterações → Andante e Poco Andante (2/4 e 3/4). Cada linha e cada exemplo por corda é selecionável; filtros de exercícios e peças, sem bloqueios.
- **Cada tópico abre uma lista curta** (nome + uma frase). Clicar = começar.
- **Nenhuma configuração antes de começar.** Os ajustes são ícones no canto inferior direito da atividade, e cada um abre um balão pequeno. Ficam salvos por atividade.
  - Mudam sem reiniciar: som, BPM (Leitura), ♯♭.
  - Reiniciam a sessão sozinhos: tempo livre/metrônomo, figuras, duração, notas; no Ritmo, todos.
- **Um número só na tela** (acerto % ou pontos). O resto fica no resumo, que aparece ao sair com 10 ou mais notas feitas.
- **Som dos botões:** piano por padrão (violão ou mudo como opção), sempre na altura real do violão.
- **Cola das notas:** botão que mostra todas as linhas e espaços até a casa 12, com seta para expandir até a 19.

### Trilhas (`src/lessons/`)

- **Unidade → lições → segmentos** (`curriculum.ts`). Segmento = notas na pauta (`NotesSegment`), ritmo (`RhythmSegment`) ou partitura no tempo (`ScoreSegment`, a Leitura/Notas com metrônomo). Um cartão separa segmentos.
- **Teoria musical, 9 unidades, notas e ritmo intercalados** (cada uma com guia): Notas na pauta · Pulso e figuras · Compasso · Suplementares · Pausas · Colcheias · Ponto de aumento · Leitura de partitura · Acidentes.
- **Violão:** Primeira posição, corda por corda (1ª à 6ª) + Desafio. A ordem **não** é a do Henrique Pinto (ele faz 6ª-5ª-4ª e depois 3ª-2ª-1ª, mas supõe que o aluno já lê): aqui a leitura fica mais difícil junto, das notas dentro da pauta até o Mi com 3 suplementares. Cada corda: notas pelo microfone (o braço mostra onde fica na apresentação, depois de um erro e na cola) e "no tempo" (cada nota repetida por um compasso, com metrônomo). Errou no violão: a nota **espera a certa** com o braço à vista (conta um erro só), como na atividade Notas.
- **Teoria = cartões de conceito** (`cards.tsx`, desenhos em `art.tsx`): uma frase e um desenho, alguns com "ouvir". Abrem sozinhos só na primeira vez que a lição é aberta (`seenCards`, chave `lesson:<id>`; lição já feita conta como vista); reiniciar ou refazer vai direto ao exercício; o "?" reabre. Atividades com cartões (Escala, Ritmo) mostram na primeira vez (`meta.seenCards`).
- **A pauta não tem exercício:** grave/agudo, 5 linhas e 4 espaços, linha × espaço e a clave abrem a 1ª lição como cartões. Havia uma unidade inteira perguntando "linha ou espaço" e "qual linha": cortada por treinar o que se vê de relance.
- **Notas na pauta: linhas e espaços juntos, por referências** (Chediak e a pedagogia de leitura atual: notas de referência + passos e pulos, não "Mi Sol Si Ré Fá" decorado). Sol da clave e vizinhos (passo) → Mi e Si (pulo; antes, o **mapa** com as 9 notas) → Dó do 3º espaço (2ª referência) e Ré → Mi e Fá de cima → Desafio. Linhas e Espaços separados davam a sensação de pauta pela metade.
- **Cartões grandes** (desenho ~320 px de altura na tela larga): o desenho é o que explica.
- **Lição de notas** (nos botões; o violão espera a certa, ver acima): apresenta as notas novas repetidas (nome + cola; em Notas na pauta uma vez só, `times: 1`), padrão (cola fraca), sorteio. A ajuda some aos poucos, não de uma vez (para o iniciante não se perder): a cola continua fraca no começo do sorteio e apaga em `fadeNotes`; depois de um erro volta fraca por `supportNotes` notas; "ver a cola" (H) acende tudo na nota da vez, que não conta e volta depois. Nada disso no Desafio. Semibreves sem compasso. Errou: mostra o nome e o lugar ("2ª linha"), espera e segue; no sorteio a nota volta 3 notas depois, com a cola acesa só nela.
- **Lição de ritmo** (à la Musicca / Complete Rhythm Trainer): imitar (ouvir e bater), ler (só o metrônomo), escrever (paleta de figuras), "quantos pulsos dura?" e "complete o compasso". "Quantos pulsos" só onde há confusão real (Semibreve, com as três figuras; pausas de mínima × semibreve), não logo depois do cartão que deu a resposta. 2/4 vai junto com 3/4 (sozinho, com semínima e mínima, só teria dois compassos possíveis). Pauta de uma linha. Bate-se no espaço (ou clique/toque); o cartão pede para marcar o pulso com o pé. Um compasso de contagem; a contagem 1 2 3 4 acende sob a pauta. Errou: notas perdidas em vermelho, o app toca o certo e segue; o trecho volta mais adiante.
- **Desafio** (última lição da unidade): sem ajuda; notas: 90% e até 2 s por nota (3 s no violão); ritmo: 90%. Passar no Desafio fecha a unidade (quem já sabe pula as lições). O cartão da unidade mostra o recorde de tempo.
- **Depois do Desafio, treinar na prática:** cada unidade tem `practice` (atividade + ajustes, ex.: Leitura com Notas = Pauta). "Treinar em …" abre a atividade com esses ajustes **só desta vez** (`onceOptions`, sem gravar os do aluno). No resultado do Desafio: passou → um quadro com o treino; faltou acerto → "de novo" e o quadro (mais o guia); faltou só tempo → treinar vira a ação principal. O cartão da unidade feita também tem o atalho.
- **Guias** (`src/lessons/guides.tsx`, rota `#/guia/<unidade>`): a teoria da unidade numa página para ler com calma, com desenhos grandes e som. Opcional: aberto pelo cartão da unidade ("guia"), pelos cartões de conceito ("prefere ler com calma?") e pelo Desafio não passado. Um por unidade da Teoria; texto próprio, na ordem do Chediak em Notas na pauta (altura → notas naturais e letras → pentagrama → clave → passo e pulo → mapa → como treinar).
- **Acidentes com barra de compasso:** nas lições de ♯♭ há uma barra entre cada nota (`barEach`), para um ♯ não passar para a nota seguinte. "Até a barra" ensina a regra com compassos (parte `bars`): dentro do compasso, a nota sem sinal herda o acidente de antes (desenhada sem ele, vale com ele); a barra e o ♮ desfazem. Bequadro em nota solta não tinha função.
- **Leitura de partitura:** "Pela pauta toda" (suplementares, mais devagar) antes do Desafio, que antes saltava de 9 para 21 notas. Entra a mínima pontuada; colcheias ficam fora da leitura com botões (rápidas demais para dizer nome a nome).
- **Dicas** (`src/lessons/tips.ts`): 2 erros seguidos ou 3 nas últimas 8 respostas mostram uma frase "Lembre-se: …" escolhida pelo tipo de erro (pulo, vizinha → clave e depois passo, Dó na metade de cima, suplementares, acidente). Só nos botões, fora do Desafio e da apresentação; some depois de 4 respostas; no mínimo 8 respostas entre dicas. Texto claro e completo, não enigmático.
- **Revisão:** 20% do sorteio vem das unidades anteriores (pauta em Suplementares, cordas anteriores no violão). O Mi da 1ª linha e o Mi/Fá de cima são referência: ficam no padrão, fora do sorteio.
- Fim da lição: "próxima", "+ 10" (na mesma tela), "de novo". **Nada bloqueado.** Progresso em `meta.trail`, pelo id da lição; parâmetros em `LESSON` e `RHYTHM` (`src/config.ts`).
- **Ids:** `unidade-N` pela posição. Ao cortar uma lição, as que ficam mantêm o número (`n` em `lessonsOf`) para o progresso guardado continuar valendo. Unidade refeita ganha id novo (`notas`, não `pauta`, que já foi usado) para não herdar progresso de outra coisa.

### Regras que valem para o app todo

- **Tempo livre = semibreves sem barras** (não há ritmo, a figura não quer dizer duração). **Metrônomo = figuras e compasso de verdade.**
- **Figuras (nível 1–5) na ordem da trilha:** semínima · + mínima e semibreve · + pausas · + colcheias · + pontuadas.
- **Leitura com botões: errou, mostra a certa e segue.** O violão (Notas) espera a nota certa: tocar a certa é o treino.
- **Leitura, ajuste "Notas":** pauta (as 9 notas), suplementares ou todas (Mi3 a Mi6), um por unidade da trilha. É o treino depois de cada unidade, sem modo novo. "Linhas"/"Espaços" guardados viram "Pauta" (`noteSetOf`).

## Princípios

- **Sem redundância.** Uma variação vira opção de uma atividade existente (`ACTIVITIES` em `src/exercises/types.ts` + `ControlsDock`), nunca um modo novo. Já foram removidos, por serem redundantes: esteira contínua/espera, sprint, BPM, "No tempo", adaptativo e a tela de opções antes de começar.
- **Pouco texto, revelação gradual.** Se precisa de parágrafo explicando, o desenho está errado.
- **Nada de exercício para o que se vê de relance** ou que foi dito na tela anterior (quantas linhas, qual linha, repetir o nome que está escrito). Isso vira cartão ou animação. O esforço vai para o porquê (clave → escala → notas) e para exercícios que exigem leitura. Facilidade demais parece perda de tempo, não progresso.
- **Nada de bloquear conteúdo.** Gamificar é para acelerar o aprendizado, não para atrapalhar quem já sabe. O desbloqueio progressivo de notas está **desligado**.
- **Região fixa em Solta** (casas 0–3). O ajuste Solta/Fechada foi tirado porque o microfone não distingue a corda, só a altura.
- **Numa tela grande, pauta e botões juntos no meio** (perto do olho e do mouse); no celular, botões no rodapé (`ExerciseBody` em `src/exercises/parts.tsx`).

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

- **`src/guided/`:** transcrição musical em `catalog.ts`, partituras fixas com baixo e melodia em `Score.tsx`, transporte em `controller.ts` e julgamento dos ataques em `judge.ts`. O PDF não integra o app. `order` resolve ritornelos e D.C. al Fine; Poco Andante toca A A B B A, sem novo ritornelo na volta. Exemplos de alterações não têm compasso no livro: usam pulsos iguais e nenhum número de compasso na pauta.
  - Microfone só nos estudos de uma voz, livre ou no tempo. Arpejos e peças preservam a sobreposição das vozes, com escuta e metrônomo, sem atribuir acerto. As posições/dedos são orientações; a duração sustentada não é julgada.
  - BPM 30–200 e 1/2/4 voltas completas; uma volta já contém as repetições escritas. Alterar ajustes encerra a tentativa e deixa a prática pronta para começar com nova contagem. Pausa cancela sons agendados e exclui eventos do microfone.
  - Ajustes por estudo em `meta.study-options:<id>`; progresso em `meta.guided-progress`. Escuta não conta como prática; só microfone no tempo com ≥90% registra BPM dominado. Tentativas com microfone também entram no histórico, com `config.guided` e chave de sessão própria. Dó♭/Fá♭ e a 4ª casa são preservados nas transcrições sem mudar os conjuntos de notas das atividades existentes.

- **`src/exercises/score.ts`:** a partitura rolando (Leitura, Notas, Escala e os segmentos "no tempo" das lições): tempo livre ou metrônomo; figuras por nível ou pelas células da lição.
- **`src/lessons/`:** trilhas. `controller.ts` = lição de notas (botões, lugar ou microfone); `LessonScreen` orquestra cartões e segmentos.
- **`src/rhythm/`:** o ritmo. `controller.ts` (itens, linha do tempo, batidas), `RhythmStaff.tsx` (desenho estático, cursor por fora do React), `controls.tsx` (área de bater, paleta).
- **Animação fora do React:** `stage.ts` mexe no SVG por `transform`; o cursor do ritmo também.
  - Relógio único = `AudioContext` (`src/audio/clock.ts`). `clock()` é o tempo que está saindo no alto-falante: som agendado em T soa quando `clock() = T`, e batidas (`clock(event.timeStamp)`) comparam direto.
  - Metrônomo com agendador de lookahead; tons das figuras em `src/audio/tones.ts`.
- **Áudio:** detecção em `src/audio/tracker.ts` (ataque + estabilidade), atrás do adaptador `pitch.ts` (método McLeod sobre a autocorrelação do pitchy). O que as gravações reais mostraram (violão de nylon, set/2026):
  - A altura só é procurada na faixa do violão (75–700 Hz). O pitchy olhava a janela inteira: nos períodos longos a conta usa poucas amostras e dá picos altos por acaso, que roubavam o lugar do período certo (Ré4 lido como Sol0/Sol1).
  - O dedo encosta na corda antes do toque e faz um ruído que parece um ataque. Depois de um "fim de nota", o próximo ataque vale na hora; antes, o toque de verdade caía no intervalo mínimo entre ataques e a nota inteira se perdia.
  - **Toque é subida abrupta:** a energia precisa saltar 3× entre dois blocos vizinhos de ~10 ms. A nota que só incha (dedo encostando e soltando a corda) e o fantasma da corda solta quando o dedo sai dela sobem devagar e davam nota repetida ou a mais. Blocos de ~5 ms perdiam o polegar nas cordas graves.
  - Só um ataque abre uma nota. Aceitar nota diferente sem ataque só gerava notas a mais (outra corda soando, dedo saindo da corda). Ligados vão precisar de outro sinal de ataque.
  - Estabilidade de 60 ms (era 90): 90 perdia as notas de escala rápida, cuja leitura limpa dura ~100 ms depois do ruído do ataque.
  - **Nota esperada:** o exercício passa ao microfone a nota da vez (`poll(expected)`). Ela vale com clarity 0,7 e 40 ms, e não cede a uma leitura intrusa isolada (a mistura com outra corda soando). Medido com a esperada errada de propósito, as notas "ouvidas" sem ser tocadas quase não sobem. O teste das gravações roda nos dois modos (sozinho e no exercício).
  - **Fim da nota acompanha o ruído de fundo** (1,6× o ruído medido, mínimo 0,0035). O limite fixo de 0,006 cortava as notas curtas de escala rápida e o toque mais leve; fixo mais baixo não funcionaria num lugar com ruído.
  - Testado e descartado (piorava ou arriscava mais do que ganhava): baixar a clarity de todas as notas, medir a subida na derivada do sinal, aceitar ataque mais fraco se for forte como a nota anterior, conferir a nota esperada direto no período dela, aceitar ataque mole só para a nota esperada (aceitava erro de oitava), cortar a janela no ataque.
  - Resultado na escala Solta (33 notas, subindo e descendo, no exercício): até ~2,7 notas/s, 97–100%; a 3,7–4,2 notas/s, 86–88% (perde Ré4 e Fá4 das cordas 1 e 2, curtos e fracos, com cordas soltas soando). As 6 cordas soltas em sequência (polifonia) continuam fora do alcance (limites em `KNOWN`). Números, gravação por gravação, e o que foi descartado: [DETECCAO-RELATORIO.md](DETECCAO-RELATORIO.md) e [DETECCAO-DADOS.md](DETECCAO-DADOS.md).
- **Parâmetros ajustáveis:** todos em `src/config.ts`.
- **Armadilha:** o `<svg>` da pauta do exercício recebe a classe `staff` do palco *e* do React. Se o `className` do React mudar sem incluir `staff`, somem as cores das linhas e da clave.
- **Armadilha:** campos de classe inicializados com `this.d` rodam antes do construtor (ES2022); inicialize no construtor.

## Rodar e testar

- `docker compose up` → http://localhost:5173. Nada de Node no host.
- Testes e tipos: `docker compose exec app npx vitest run` e `docker compose exec app npx tsc -b`.
- **Histórico da detecção (combinado):** ao avaliar mudanças no detector, registrar uma rodada completa com `docker compose run --rm -e RODADA="Descrição da mudança" app npm run test:detector`. Preservar e commitar os JSONs numerados em `docs/deteccao/historico/`, o resumo `historico/RESULTADOS.md`, os SVGs em `historico/graficos/` e `dados.json`. Cada rodada guarda versão, parâmetros, hashes de código/áudio/gabarito e resultados; o resumo compara primeira e última sobre arquivos e leituras compatíveis. Não sobrescrever ou remover rodadas, inclusive regressões. A suíte normal de regressão não gera histórico; a avaliação completa é necessária para documentar a evolução no GitHub. Ver [DETECCAO-DADOS.md](DETECCAO-DADOS.md).
- **Teste da escala:** `#/teste-escala` (só em desenvolvimento) grava a escala do exercício, 1 ou 4 voltas seguidas, com a nota esperada, em `src/audio/fixtures/sessao/` (fora do git). As tomadas boas viram gravações do teste (`fixtures/`, com o gabarito no `.json`); as duvidosas ficam em `fixtures/revisar/` (no git, fora do teste). O laboratório `src/dev/laboratorio.test.ts` analisa uma gravação, mostra leitura por leitura, varre parâmetros com teste de risco e gera `docs/deteccao/dados.json` (instruções no cabeçalho).
- **Gravações reais do detector:** `#/gravar` (só em desenvolvimento) grava o violão pelo mesmo caminho que o detector ouve e salva em `src/audio/fixtures/` (`.wav` + `.json` com as notas esperadas e o que foi ouvido ao vivo). `tracker.fixtures.test.ts` roda o detector sobre cada uma. As tomadas ficam em `src/dev/takes.ts`; gravar de novo cria `<id>-2`, `-3`… Se a execução errar, corrija `expected` no `.json` e explique em `obs` (conferir a energia do ataque separa toque de nota fantasma). Tomadas sem som útil ficam em `fixtures/descartadas/` (fora do git).
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
- Detector: **assinaturas das notas do violão do aluno** (aprender das gravações o espectro de cada nota e procurá-las no som, fatoração informada pela partitura). É o caminho para escala rápida e cordas soando juntas, onde o método atual parou (ver [DETECCAO-RELATORIO.md](DETECCAO-RELATORIO.md), próximos passos). Antes: confirmar ao vivo a configuração atual com uma tomada de 4 voltas.
