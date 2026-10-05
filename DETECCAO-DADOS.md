# Detecção de notas no violão: dados

Os dados da sessão de 29–30/set/2026, organizados para consulta e para um painel futuro. O relato (por que, o que foi descartado, erros, próximos passos) está em [DETECCAO-RELATORIO.md](DETECCAO-RELATORIO.md).

Toda medição tem uma fonte: o que for gerado pelo laboratório é reproduzível; o que vem das varreduras feitas durante a sessão está marcado como **histórico** (o código de então não existe mais como parâmetro, e o conjunto de gravações mudou ao longo da sessão, então os totais de uma tabela histórica não se comparam com os de outra).

## Onde estão

| O quê | Onde | Observação |
|---|---|---|
| Gravações do teste (30) | `src/audio/fixtures/*.wav` + `.json` | WAV mono, 16 bits, 48 kHz. O `.json` é o gabarito (`expected`: notas soando, em ordem), `how`, `obs` e `live` (o que o detector **da época** ouviu ao vivo; não é gabarito) |
| Gravações a confirmar (2) | `src/audio/fixtures/revisar/` | toque fraco; fora do teste até confirmar a execução |
| Tomadas brutas desta sessão | `src/audio/fixtures/sessao/` | **fora do git** (só neste computador): escala-1…7 como gravadas, incluindo a de 8 voltas contínua (121 s) e o começo interrompido (escala-6) |
| Descartadas antigas | `src/audio/fixtures/descartadas/` | fora do git; 2 s e 0,6 s sem som útil |
| **Dados gerados** | [`docs/deteccao/dados.json`](docs/deteccao/dados.json) | por gravação: nível, andamento, erros por leitura e modo, cada erro com posição e tempo, notas achadas com desvio em cents; risco; parâmetros |
| Linha de base | [`docs/deteccao/inicial-35ce63a.json`](docs/deteccao/inicial-35ce63a.json) | o detector do commit `35ce63a` sobre as mesmas gravações (só o modo sozinho: não havia nota esperada) |
| Laboratório | `src/dev/laboratorio.test.ts` | gera `dados.json` e faz as análises (ver o cabeçalho do arquivo) |

Gerar uma rodada completa (com o detector atual), preservando o histórico:

```
docker compose run --rm -e RODADA="Descrição da mudança avaliada" app npm run test:detector
```

## Histórico a partir de agora

O comando acima salva uma rodada completa, numerada em ordem crescente, em
[`docs/deteccao/historico/`](docs/deteccao/historico/RESULTADOS.md). Os arquivos
`0001.json`, `0002.json` etc. permanecem intactos. `dados.json` continua sendo
um atalho para a última rodada. O resumo em Markdown apresenta todas as rodadas
em ordem e compara a primeira com a última, sobre gravações comuns e condições
compatíveis. Está pronto para consulta no GitHub quando os arquivos forem commitados.

Na primeira execução, o relatório que já existia é preservado como rodada 1,
identificado como histórico importado. Não atribuímos a ele uma versão ou hashes
que não foram registrados na época. A comparação com esse relatório é marcada
como provisória. Após duas rodadas novas, o resumo também compara a primeira
rodada com hashes com a última, para acompanhar a evolução com arquivos confirmados.
A linha de base `inicial-35ce63a.json` permanece disponível
separadamente; não inventamos uma data ou uma execução completa para ela.

Cada rodada nova registra data UTC, descrição (`RODADA`), commit e branch,
parâmetros, hash do código/dependências e hashes do áudio e gabarito de cada
gravação, além de todos os resultados detalhados. Sem Git no ambiente,
`alterado` fica `null`; o hash do código ainda identifica o conteúdo testado.
As gravações de `revisar/` são preservadas no JSON, mas excluídas dos totais.

Execute `test:detector` para cada versão que quiser comparar e inclua os novos
JSONs, `historico/RESULTADOS.md`, `historico/graficos/` e `dados.json` no commit da mudança. Rodadas podem
mostrar regressão ou resultado igual; nenhuma é descartada por isso. O comando
usa um contêiner temporário e não abre outra porta. Com o serviço já rodando,
pode usar `docker compose exec -e RODADA="Descrição" app npm run test:detector`.

A suíte normal (`npm test`) verifica regressões e não cria rodadas. Explorações
com `GRAVACAO`, `DUMP` ou `VARREDURA` continuam diagnósticas: para preservar os
resultados oficiais de uma mudança, rode a avaliação completa acima. `SO`
filtra o conjunto; o resumo evita comparar totais de conjuntos diferentes.
Uma execução incompleta não gera rodada. Não rode dois relatórios ao mesmo tempo;
um bloqueio impede escritores concorrentes. Se o processo for encerrado à força,
remova `historico/.lock` somente depois de confirmar que não há relatório rodando.

O histórico mede detecção offline neste conjunto de gravações reais. Ele não
substitui validação ao vivo nem comprova desempenho em outros violões,
microfones ou ambientes. O resumo informa a métrica e suas limitações.

Os gráficos SVG de acertos e erros são gerados automaticamente e aparecem em
`historico/RESULTADOS.md`. Usam somente rodadas com hashes registrados, com as
mesmas leituras e arquivos em comum. Os resultados importados permanecem nas
tabelas. Cada ponto representa uma rodada, independentemente da data.

Para atualizar somente o documento e os gráficos a partir dos JSONs existentes,
sem executar o detector ou criar uma rodada:

```
docker compose run --rm app npm run test:detector:resumo
```

## Setup

- Violão de nylon, afinado pelo GuitarTuna. Cordas altas; pode trastejar um pouco (informação do usuário).
- Microfone: o padrão do sistema (o `device` gravado é "Default"). Modelo não registrado.
- Captura: `getUserMedia` sem cancelamento de eco, supressão de ruído nem ganho automático; 48 kHz.
- Ambiente: não medido. O ruído de fundo de cada gravação (p10 do RMS em janelas de 50 ms) está nas tabelas: 0,0025–0,0080.
- Um só violão, um só microfone, um só lugar.

## Como se mede

- **Leituras:** o detector roda sobre o WAV como ao vivo, uma janela de 2048 amostras por quadro, em 4 leituras: `60` (60 Hz), `60b` (60 Hz, fase +8 ms), `144` (144 Hz), `60j` (60 Hz com ±50% de variação). Os totais somam as 4.
- **Erros:** distância de edição entre o gabarito e as notas achadas: **perdida** (tocada, não achada), **trocada** (achada outra) e **a mais** (achada sem ter sido tocada).
- **Modos:**
  - **sozinho:** o detector sem saber a nota esperada;
  - **exercício:** o detector sabe a nota esperada, que anda a cada acerto e também quando ele ouve a seguinte (o aluno seguiu em frente, porque as gravações foram tocadas direto).
- **Acerto** = 1 − erros ÷ (notas × 4).
- **Andamento:** notas tocadas menos 1, divididas pelo tempo entre o primeiro e o último ataque achados (leitura 60, exercício). Fica vazio quando ele acha menos da metade das notas.
- **Nível:** RMS em janelas de 50 ms. Pico = p95, mediana = p50, ruído = p10.
- **Risco:** com a nota esperada **errada** de propósito (+1, −1, +2, −2, +7, −5, +12, −12 semitons da tocada), quantas vezes o detector "ouve" a esperada. Leitura 60, só as gravações do teste.

## Tomadas desta sessão

Nível e destino. Todas feitas pela tela `#/teste-escala`, com a escala Solta (33 notas por volta).

| Tomada | Duração | Voltas | Pico | Mediana | Ruído | Detector ao vivo | Destino |
|---|---|---|---|---|---|---|---|
| escala-1 | 25,4 s | 1 | 0,132 | 0,0167 | 0,0046 | original | `escala-solta-1` |
| escala-2 | 55,2 s | 1 | 0,102 | 0,0161 | 0,0028 | + faixa 75–700 Hz | `escala-solta-2` |
| escala-3 | 16,0 s | 1 | 0,092 | 0,0139 | 0,0032 | + subida (blocos de 5 ms) | `escala-solta-3` |
| escala-4 | 15,2 s | 1 | 0,051 | 0,0144 | 0,0028 | + nota esperada, blocos de 10 ms | `revisar/escala-solta-fraca-1` |
| escala-5 | 18,6 s | 1 (tela esperava 4) | 0,046 | 0,0105 | 0,0027 | idem | `revisar/escala-solta-fraca-2` (gabarito cortado para 1 volta) |
| escala-6 | 15,1 s | 1, interrompida | 0,066 | 0,0175 | 0,0035 | idem | só em `sessao/` |
| escala-7 | 121,2 s | 8 seguidas | 0,070 | 0,0188 | 0,0030 | idem | `escala-solta-voltas-1…8` (cortadas de 0,4 s antes do primeiro Mi a 0,7 s depois do último) |

O ruído não mudou entre as tomadas; o pico caiu de 0,13 para 0,05. Isso é o toque mais leve (ou mais longe do microfone), não o ganho.

## Por gravação (detector atual × inicial)

Erros somando as 4 leituras. Fonte: `dados.json` e `inicial-35ce63a.json`.

| Gravação | Notas/s | Pico | Inicial | Sozinho | Exercício | Exercício: perdidas/trocadas/a mais | Acerto no exercício |
|---|---|---|---|---|---|---|---|
| cordas-soltas | 0,39 | 0,433 | 0 | 0 | 0 | 0/0/0 | 100% |
| escala-aberta-lenta | 0,99 | 0,191 | 6 | 0 | 0 | 0/0/0 | 100% |
| escala-aberta-rapida | 2,71 | 0,203 | 9 | 5 | 1 | 0/0/1 | 99% |
| escala-fechada-lenta | 0,70 | 0,190 | 4 | 0 | 0 | 0/0/0 | 100% |
| escala-fechada-lenta-2 | 0,89 | 0,227 | 5 | 2 | 2 | 0/0/2 | 99% |
| escala-fechada-rapida | 1,20 | 0,178 | 0 | 0 | 0 | 0/0/0 | 100% |
| escala-fechada-rapida-2 | 1,31 | 0,200 | 2 | 0 | 0 | 0/0/0 | 100% |
| escala-fechada-rapida-3 | 2,14 | 0,180 | 0 | 0 | 0 | 0/0/0 | 100% |
| escala-solta-1 | 1,66 | 0,132 | 4 | 4 | 0 | 0/0/0 | 100% |
| escala-solta-2 | 0,66 | 0,102 | 5 | 0 | 0 | 0/0/0 | 100% |
| escala-solta-3 | 3,36 | 0,092 | 28 | 21 | 5 | 5/0/0 | 96% |
| escala-solta-voltas-1 | 1,71 | 0,071 | 3 | 2 | 2 | 0/0/2 | 98% |
| escala-solta-voltas-2 | 2,53 | 0,068 | 8 | 7 | 4 | 4/0/0 | 97% |
| escala-solta-voltas-3 | 2,25 | 0,071 | 6 | 4 | 0 | 0/0/0 | 100% |
| escala-solta-voltas-4 | 3,70 | 0,064 | 23 | 22 | 18 | 18/0/0 | 86% |
| escala-solta-voltas-5 | 3,21 | 0,087 | 18 | 22 | 9 | 5/4/0 | 93% |
| escala-solta-voltas-6 | 2,68 | 0,084 | 11 | 8 | 4 | 4/0/0 | 97% |
| escala-solta-voltas-7 | 4,13 | 0,096 | 24 | 25 | 16 | 16/0/0 | 88% |
| escala-solta-voltas-8 | 4,24 | 0,060 | 39 | 41 | 16 | 16/0/0 | 88% |
| re-2-casa3 | 0,52 | 0,065 | 0 | 0 | 0 | 0/0/0 | 100% |
| re-4-solta | 0,47 | 0,337 | 0 | 0 | 0 | 0/0/0 | 100% |
| si-2-solta | 0,59 | 0,178 | 0 | 0 | 0 | 0/0/0 | 100% |
| si-5-casa2 | 0,74 | 0,490 | 0 | 0 | 0 | 0/0/0 | 100% |
| soltas-lenta | — | 0,072 | 48 | 48 | 48 | 48/0/0 | 0% |
| soltas-lenta-2 | 1,45 | 0,147 | 32 | 28 | 28 | 27/1/0 | 42% |
| soltas-lenta-3 | 1,28 | 0,330 | 21 | 23 | 22 | 18/4/0 | 54% |
| soltas-rapida | — | 0,417 | 44 | 44 | 40 | 40/0/0 | 17% |
| soltas-rapida-2 | — | 0,306 | 44 | 44 | 44 | 44/0/0 | 8% |
| soltas-rapida-3 | — | 0,340 | 44 | 44 | 34 | 34/0/0 | 29% |
| soltas-rapida-4 | — | 0,326 | 40 | 40 | 40 | 40/0/0 | 17% |
| revisar/escala-solta-fraca-1 | 3,44 | 0,051 | 42 | 37 | 30 | 30/0/0 | 77% |
| revisar/escala-solta-fraca-2 | 2,47 | 0,046 | 29 | 31 | 31 | 26/5/0 | 77% |

Por grupo:

| Grupo | Gravações | Notas × leituras | Inicial | Sozinho | Exercício |
|---|---|---|---|---|---|
| Escalas (sem `revisar/`) | 18 | 2316 | 195 erros (91,6%) | 163 (93,0%) | 77 (96,7%) |
| Escala Solta desta sessão | 11 | 1452 | 169 (88,4%) | 156 (89,3%) | 74 (94,9%) |
| Notas isoladas | 5 | 156 | 0 (100%) | 0 (100%) | 0 (100%) |
| Cordas soltas ida e volta | 7 | 336 | 273 (18,8%) | 271 (19,3%) | 256 (23,8%) |
| `revisar/` | 2 | 264 | 71 (73,1%) | 68 (74,2%) | 61 (76,9%) |

## Escala Solta: acerto por andamento (exercício)

| Notas/s | Gravações | Acerto |
|---|---|---|
| 0,66–1,71 | solta-2, solta-1, voltas-1 | 98–100% |
| 2,25–2,68 | voltas-3, voltas-2, voltas-6 | 97–100% |
| 3,21–3,36 | voltas-5, solta-3 | 93–96% |
| 3,70–4,24 | voltas-4, voltas-7, voltas-8 | 86–88% |

## Onde erra: nota × posição (escala Solta, exercício)

Quantas vezes cada posição da escala foi perdida ou trocada, somando as 11 gravações e as 4 leituras (↑ subindo, ↓ descendo). Posições sem erro não aparecem.

| Pos. | Nota | Corda·casa | Erros |
|---|---|---|---|
| 6 ↑ | Dó3 | 5ª·3 | 4 |
| 7 ↑ | Ré3 | 4ª·0 | 4 |
| 8 ↑ | Mi3 | 4ª·2 | 4 |
| 11 ↑ | Lá3 | 3ª·2 | 4 |
| 12 ↑ | Si3 | 2ª·0 | 5 |
| 14 ↑ | **Ré4** | 2ª·3 | **10** |
| 15 ↑ | Mi4 | 1ª·0 | 1 |
| 16 ↑ | **Fá4** | 1ª·1 | 5 |
| 18 ↓ | **Fá4** | 1ª·1 | **10** |
| 20 ↓ | **Ré4** | 2ª·3 | **7** |
| 21 ↓ | Dó4 | 2ª·1 | 4 |
| 22 ↓ | Si3 | 2ª·0 | 1 |
| 27 ↓ | Ré3 | 4ª·0 | 5 |
| 28 ↓ | Dó3 | 5ª·3 | 4 |
| 31 ↓ | Sol2 | 6ª·3 | 4 |

Os nomes são do som (o violão soa uma oitava abaixo do escrito). A mesma análise feita durante a sessão sobre as 8 voltas (leitura 60, histórico) deu Fá4 perdido em 4 voltas subindo e 4 descendo, e Ré4 em 3 e 3, quase todos nas voltas de 3,2 notas/s ou mais.

## Afinação: desvio em cents

Das notas achadas (leitura 60, exercício) em escala-solta-1, solta-2, voltas-1 e voltas-3: mínimo, máximo e média. Tolerância do detector: ±45 cents.

| Nota | Mín | Máx | Média | | Nota | Mín | Máx | Média |
|---|---|---|---|---|---|---|---|---|
| Mi2 (solta) | −9 | −6 | −7 | | Sol3 (solta) | −2 | +38 | +6 |
| Fá2 | −6 | +2 | −2 | | Lá3 | +10 | +19 | +15 |
| Sol2 | +3 | +14 | +7 | | Si3 (solta) | −4 | +7 | +1 |
| Lá2 (solta) | −9 | −2 | −5 | | Dó4 | −4 | +15 | +7 |
| Si2 | +8 | +13 | +11 | | Ré4 | −1 | +21 | +14 |
| Dó3 | +2 | +13 | +10 | | Mi4 (solta) | 0 | +6 | +4 |
| Ré3 (solta) | −12 | +4 | −2 | | Fá4 | −6 | +11 | +7 |
| Mi3 | −9 | +2 | −4 | | Sol4 | +10 | +14 | +12 |
| Fá3 | −4 | +12 | +3 | | | | | |

Soltas perto de 0; presas quase sempre agudas (+7 a +15 de média), o esperado com cordas altas. Nenhuma perto da tolerância. O desvio é medido ~60 ms depois do ataque, quando a corda ainda está um pouco aguda.

## Risco (detector atual)

Com a esperada errada de propósito, 67 notas "ouvidas" sem ser tocadas em 5616 casos (1,2%). Por deslocamento:

| +1 | −1 | +2 | −2 | +7 | −5 | +12 | −12 |
|---|---|---|---|---|---|---|---|
| 7 | 5 | 12 | 0 | 12 | 11 | 9 | 11 |

Parte disso não é falso de verdade: numa escala, a nota seguinte fica a 1 ou 2 semitons, e o aluno de fato a toca. Esse número serve para **comparar variantes**, não como taxa absoluta.

## Medições históricas (varreduras da sessão)

Não são reproduzíveis com o código atual sem recriar o parâmetro. Cada tabela vale para o conjunto de gravações daquele momento.

**1. Clarity na faixa 200–500 Hz** (detector com a faixa 75–700 Hz; 21 antigas + tomada 1; total sozinho):

| Variante | Total | escala-aberta-rápida | tomada 1 |
|---|---|---|---|
| 0,86 (atual) | 291 | 8 | 4 |
| 0,82 | 288 | 9 | 0 |
| 0,78 | 290 | 9 | 2 |
| 0,75 | 294 | 9 | 3 |
| 0,80 em todas | 293 | 12 | 1 |

**2. Subida mínima, blocos de 5 ms** (21 antigas + tomadas 1 e 2; total sozinho):

| Limite | 0 (sem) | 1,3 | 1,6 | 2 | 2,5 | 3 | 3,5 | 4 | 5 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|
| Total | 295 | 293 | 286 | 285 | 280 | **279** | 280 | 290 | 313 | 347 |

Com 4, cordas-soltas passa de 0 para 4 erros (toques de verdade perdidos). Na derivada do sinal: 363 (limite 2), 785 (3), 1183 (4), 1396 (6).

**3. Nota esperada** (21 antigas + tomadas 1–3; escalas e notas isoladas; exercício sem seguir o aluno):

| Variante | Sem esperada | Com esperada | Risco (falsos em 2832) |
|---|---|---|---|
| sem relaxar | 32 | 30 | 15 |
| clarity 0,75, 60 ms | 32 | 21 | 17 |
| **clarity 0,70, 40 ms** | 32 | **15** | **21** |
| clarity 0,75, 40 ms | 32 | 18 | 21 |
| clarity 0,80, 40 ms | 32 | 22 | 20 |
| + conferência direta 0,8 (corrigida) | — | 12 | 30 |

**4. Fim de nota** (+ tomadas 4, 5 e as 8 voltas; exercício sem seguir o aluno):

| Variante | Com esperada |
|---|---|
| 0,006 fixo (antes) | 205 |
| 0,0045 fixo | 188 |
| 0,0035 fixo | 183 |
| **ruído × 1,6, mínimo 0,0035** | **183** |
| ruído × 2, mínimo 0,0035 | 187 |
| ruído × 1,6, mínimo 0,003 | 182 |

**5. Subida mínima no exercício, blocos de 10 ms** (mesmo conjunto, seguindo o aluno):

| Limite | Erros | Perdidas | Trocadas | A mais |
|---|---|---|---|---|
| **3** | **138** | 124 | 9 | 5 |
| 2,7 | 134 | — | — | — |
| 2,5 | 122 | 101 | 9 | 12 |
| 2,2 | 117 | 94 | 10 | 13 |
| 2 | 120 | — | — | — |
| 0 (sem) | 135 | — | — | — |

Ataque mole só para a nota esperada (limite 3 mantido): erros 133 / 124 / 125 / 130 com 2,5 / 2,2 / 2 / 1,8; risco 111 / 128 / 134 / 131 em 5472 (contra 74 sem a regra; oitava acima de 11 para 23–29).

## Parâmetros finais

Em `src/config.ts` (`DETECTION`) e em `dados.json` (`parametros`). Os que mudaram nesta sessão:

| Parâmetro | Antes | Agora |
|---|---|---|
| faixa da busca de altura | janela inteira (~23 Hz para cima) | 75–700 Hz (`minFreq`, `maxFreq`) |
| `onsetSharpness` | — | 3 |
| `sharpBlock` | — | 512 amostras (~10 ms) |
| `expectedClarity` / `expectedStableTime` | — | 0,7 / 40 ms |
| `releaseRms` | 0,006 | 0,0035 (mínimo) |
| `releaseOverFloor` / `floorRise` | — | 1,6 / 0,1 por segundo |

## Para um painel

O `dados.json` já tem o que um painel precisa sem recalcular:
- `gravacoes[].modos.{sozinho,exercicio}.{60,60b,144,60j}.ops[]` traz cada erro com tipo, posição, nota esperada e ouvida, e tempo no arquivo. Dá para desenhar a linha do tempo de cada tomada sobre o WAV.
- `achado60[]` traz as notas achadas com tempo de ataque e cents: afinação e andamento nota a nota.
- `nivel` e `notasPorSegundo` permitem cruzar acerto com volume e andamento.
- `inicial-35ce63a.json` dá o "antes" de cada gravação.

Ao mudar o detector, rode o laboratório de novo e guarde o `dados.json` anterior com o commit no nome, como o inicial. Assim cada versão vira um ponto na série.
