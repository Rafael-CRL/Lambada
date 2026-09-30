# Detecção de notas no violão: relatório da sessão de 29–30/set/2026

Como o detector foi medido e mudado a partir de gravações reais, o que funcionou, o que foi descartado, onde eu (a IA) errei e o que continua em aberto. Os números detalhados estão em [DETECCAO-DADOS.md](DETECCAO-DADOS.md). O resumo operacional está em [NOTAS-DO-PROJETO.md](NOTAS-DO-PROJETO.md) (Áudio).

Branch `detector-gravacoes`, a partir do commit `35ce63a`. As notas estão nomeadas **pelo som**, como o detector as entrega: o app mostra o escrito, uma oitava acima (o Ré4 daqui é o Ré5 da pauta).

## O problema

Na atividade **Escala** (Solta: naturais, casas 0–3, Mi2 → Sol4 → Mi2, 33 notas), o microfone às vezes não reconhecia notas tocadas certo, e às vezes ouvia notas que ninguém tocou. As gravações antigas já mostravam os limites (mistura com cordas soltas soando, nota fantasma, polifonia), mas os parâmetros tinham sido ajustados em gravações com variação de execução e de ruído.

## O ciclo de teste

1. **A referência é a execução do usuário.** Ele toca a escala Solta subindo e descendo, que conhece e executa com precisão. O gabarito é a **ordem** das 33 notas; não há tempos de referência.
2. **Tela descartável `#/teste-escala`** (só em desenvolvimento): a mesma escala do exercício, a nota da vez esperando a certa. Grava a entrada crua (AudioWorklet, o mesmo caminho do detector), salva `.wav` + `.json` (gabarito e o que o detector ouviu ao vivo). Depois ganhou **1 ou 4 voltas** seguidas.
3. **Espera pela tomada:** um laço em segundo plano esperava o arquivo aparecer; a análise começava assim que o usuário apertava "Terminei".
4. **Análise offline:** o detector roda de novo sobre o `.wav` em 4 leituras (60 Hz, 60 Hz em outra fase, 144 Hz, 60 Hz irregular), como o AnalyserNode é lido ao vivo. Compara com o gabarito por distância de edição (notas perdidas, trocadas e a mais). Quando um erro aparecia, o `DUMP` mostrava cada leitura (energia, frequência, clarity, subida, eventos) no trecho.
5. **Decisão por medição:** cada ideia virava parâmetro e passava por uma **varredura** sobre todas as gravações (as 21 antigas mais as novas). Só ficava o que melhorava o conjunto sem criar regressão. Mudanças que mexem na nota esperada passavam também pelo **teste de risco**: a esperada errada de propósito (±1, ±2 semitons, quinta, oitava), contando quantas vezes o detector "ouvia" a esperada sem ela ter sido tocada.
6. **Sintéticos continuam valendo:** os testes de som sintético (`tracker.test.ts`) rodaram a cada rodada. Dois foram corrigidos para refletir o violão real, e três casos novos foram acrescentados.

Tomadas: 7 (a 7ª com 8 voltas seguidas, do lento ao muito rápido), mais 2 descartadas. Ver o inventário em [DETECCAO-DADOS.md](DETECCAO-DADOS.md).

## O que mudou no detector, em ordem

| # | Mudança | Por quê (o que os dados mostraram) | Resultado medido |
|---|---|---|---|
| 1 | **Altura procurada só na faixa do violão** (75–700 Hz), MPM próprio sobre a autocorrelação do pitchy (`pitch.ts`) | O pitchy olhava a janela inteira. Nos atrasos longos (24–49 Hz) a NSDF dava picos de 0,9+ por acaso e roubava o lugar do período certo (Ré4 lido como Sol0/Sol1). | escala-aberta-lenta 6→3, escala-aberta-rápida 9→8, soltas-lenta-2 32→24 erros; nenhuma regressão; o caso "Si3 + Mi2 solto → Mi2" sumiu |
| 2 | **Toque é subida abrupta:** a energia tem de saltar 3× entre blocos vizinhos | Tomada 2: o Mi3 "inchou" (0,009 → 0,030 em ~50 ms, clarity 0,93–0,99 o tempo todo) e virou nota repetida. As notas fantasma antigas eram o mesmo inchaço. | Com blocos de 5 ms: escala-aberta-lenta 3→0, fechada-lenta 4→0, fechada-lenta-2 5→2, fechada-rápida-2 2→0, escala-aberta-rápida 8→4, tomada 2 4→0; custo: soltas-lenta-3 21→25 |
| 3 | **Blocos da subida de ~10 ms** (512 amostras) | Tomada 3: o Lá2 tocado com o polegar subiu 2,3× em 5 ms (ataque mais macio); menos de um período das notas graves faz a medida oscilar com a fase | escalas: 35→32 erros (sozinho); tomada 3 no exercício 25→12 |
| 4 | **Nota esperada** (`mic.poll(expected)`): clarity mínima 0,7, estabilidade 40 ms, e não cede a uma leitura intrusa isolada | Ré4 e Fá4 com cordas soltas soando: clarity ~0,8 e ~40 ms de nota limpa; a leitura alternava com o período da mistura (117 Hz, Sol2) | no conjunto de então: 32→15 erros; risco 15→21 falsos em 2832 casos |
| 5 | **Fim da nota acompanha o ruído de fundo** (1,6× o ruído medido, mínimo 0,0035; era 0,006 fixo) | As tomadas foram ficando mais fracas (pico 0,13 → 0,05, mesmo ruído); notas rápidas de ~130 ms caíam abaixo de 0,006 com a altura ainda legível | no exercício 205→183 erros (igual ao fixo 0,0035, mas seguro com ruído) |

A avaliação no modo exercício passou a seguir o aluno: se o detector ouve a nota **seguinte** à esperada, a esperada anda junto. Sem isso, uma nota perdida derrubava as outras em cascata, porque as gravações foram tocadas direto, sem repetir.

## Tentado e descartado

| Ideia | Resultado | Por que saiu |
|---|---|---|
| Clarity mais baixa na faixa 200–500 Hz (0,82 / 0,78 / 0,75), ou 0,80 em todas | 0,82 recuperou o Ré4 da tomada 1 e errou 1 a mais na escala-aberta-rápida; 0,78 e abaixo ficaram piores (Ré4 caindo de afinação vira Dó♯4 a mais) | ganho numa nota, perda em outra |
| Subida medida na derivada do sinal | total 785 erros contra 279 (limite 3) | o ataque do nylon é macio; o ruído agudo domina |
| Ataque "mole" aceito se for forte como a nota anterior (0,5 / 0,8 / 1× o pico) | recuperou o Ré3 de soltas-lenta-3; escala-aberta-rápida 4→7 | saldo zero |
| Intervalo entre os blocos da subida (256/512) e outros tamanhos | nenhum melhor que 512 sem intervalo | — |
| **Conferir a nota esperada direto no período dela** (com guarda de oitava) | 1ª versão: risco 21→~780 (bug meu: pegava a encosta do pico de outra nota); corrigida: erros 15→12, risco 21→30 (3 de oitava a mais) | pouco ganho para o risco |
| Cortar a janela no ataque (768–1536 amostras, ataque ignorado 25 ms) | zero mudança | com 40 ms ignorados a janela já está quase toda depois do ataque; o começo não é o gargalo |
| Mínimo de ataque 0,008 (era 0,012) | não ajudou | — |
| Subida mínima 2,5 / 2,2 em vez de 3 | −23 perdidas, +7 a mais (fantasmas do Sol3, Ré4 duplicado) | "errou" para quem tocou certo pesa mais que uma nota a repetir |
| **Ataque mole só para a nota esperada** (2,5 / 2,2 / 2 / 1,8) | erros 138→124; risco 74→128 (oitava acima 11→28) | aceita erro de oitava; o app ensina a oitava |

## Resultado final

Detector do commit `35ce63a` contra o atual, sobre as mesmas gravações e as mesmas 4 leituras:

| Grupo | Inicial | Atual, sozinho | Atual, no exercício |
|---|---|---|---|
| Escalas (18 gravações, 2316 notas×leitura) | 91,6% | 93,0% | **96,7%** |
| Escala Solta desta sessão (11) | 88,4% | 89,3% | **94,9%** |
| Notas isoladas (5) | 100% | 100% | 100% |
| Cordas soltas ida e volta, polifonia (7) | 18,8% | 19,3% | 23,8% |

Na escala Solta, no exercício, por andamento: até ~2,7 notas/s, 97–100%; 3,2–3,4 notas/s, 93–96%; 3,7–4,2 notas/s, 86–88%. No exercício, quase todos os erros são **notas perdidas**, não trocadas: o aluno toca de novo.

Sozinho (sem a nota esperada), duas voltas rápidas pioraram um pouco (volta 5: 18→22; volta 8: 39→41). O ganho grande vem da nota esperada, que é como o app usa o detector.

Testes: os de áudio foram de 50 para 97, e a suíte inteira de 194 para 241 (sintéticos novos, as gravações nos dois modos, as gravações novas). O teste de risco final (com a esperada errada de propósito) deu 67 falsos em 5616 casos.

## Onde eu errei ou me desviei

- **Conferência direta da nota esperada:** a primeira versão pegava a encosta do pico de outra nota e o risco explodiu (21→~780). O teste de risco pegou isso antes de chegar ao app.
- **Comando interrompido:** assumi que um comando interrompido não tinha rodado. Tinha, e o trecho do script ficou duplicado (erro de compilação, corrigido).
- **Comentário sem medição:** escrevi no `config.ts` que com limite 4 "já se perdiam" toques, mas isso foi medido com blocos de 5 ms, não com os de 10 ms atuais. Corrigido.
- **Andamento estimado:** falei em "4,4 notas/s" para a volta mais rápida; medido, são 4,24.
- **Instrução das 4 voltas:** não deixei claro que eram seguidas, sem apertar "Terminei". Duas tomadas saíram com uma volta só. Também não consegui testar a virada de volta no navegador (a aba de automação fica oculta e o áudio não liga), e avisei isso.
- **Plano de descartar:** a tela era para ser descartável e pus as tomadas fora do git. O usuário depois pediu para guardar, e elas foram promovidas.
- **Não medido ao vivo:** a mudança 5 (fim de nota adaptativo) e a configuração final só foram medidas offline, sobre as gravações. Nenhuma tomada foi gravada com ela.

## Em aberto

1. **Escala rápida (≥ 3,7 notas/s):** perde 12–14%, quase sempre Ré4 e Fá4 (cordas 1 e 2, subindo e descendo). São notas de ~130 ms, fracas, com cordas soltas soando e leituras uma oitava abaixo ou no período da mistura. Um ~235 Hz soando junto apareceu em várias; a origem não foi verificada.
2. **Polifonia** (as 6 cordas soltas em sequência): 8–54%. Fora do alcance de um detector de uma nota por vez.
3. **Toque fraco:** as duas tomadas em `fixtures/revisar/` (pico ~0,05) dão 77%. Falta confirmar se a execução foi limpa (numa delas o Si3 quase não soou).
4. **A subida mínima tem zona de sobreposição:** fantasma e inchaço sobem até ~3×, e um toque rápido por cima de outra nota às vezes sobe só 2,4–2,7×.
5. **Captura** ainda é o AnalyserNode lido a cada quadro (não o AudioWorklet contínuo). As 4 leituras dão quase o mesmo resultado, então isso não pesa na qualidade, mas uma aba oculta para de ler.
6. **Ligados** (hammer-on, pull-off): sem sinal de ataque, não abrem nota.

## Próximos passos sugeridos

1. **Confirmar ao vivo:** uma tomada de 4 voltas com o detector atual (a mudança 5 ainda não foi ouvida ao vivo).
2. **Assinaturas das notas do violão do aluno** (a ideia de maior alcance): aprender, destas gravações, o espectro de cada nota do violão de quem estuda, e procurar essas assinaturas no som (fatoração com notas conhecidas, NMF informada pela partitura). É o método de ponta para cordas soando juntas e resolveria os itens 1 e 2. Projeto maior; só vale se tocar rápido ou com cordas soando for objetivo do app.
3. Decidir sobre as tomadas de `revisar/`.
4. Capturar pelo AudioWorklet, se a aba oculta ou a queda de quadros virar problema.
5. Gravar com outro microfone ou ambiente: todas as medições são de um só violão, um só microfone e um só lugar.
