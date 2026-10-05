# Histórico da detecção de áudio

Rodadas em ordem de execução; cada JSON preserva os resultados completos. As datas são informativas. Rodadas antigas importadas são identificadas; não reconstruímos execuções que não foram salvas.

Os totais excluem `revisar/`. Acerto = 100 × (1 − distância de edição / notas esperadas em todas as leituras). Notas extras também contam como erro; este índice não mede precisão temporal nem qualidade em outros instrumentos ou ambientes.

| Rodada | Data UTC | Versão | Gravações | Sozinho: erros / notas | Acerto | Exercício: erros / notas | Acerto | Risco: falsos / casos | Descrição |
|---|---|---|---|---|---|---|---|---|---|
| [1](./0001.json) | 2026-09-30T04:35:04.323Z | não registrada | 30 | 434 / 2808 | 84.54% | 333 / 2808 | 88.14% | 67 / 5616 | Relatório preservado antes do início do histórico; versão e arquivos não registrados |
| [2](./0002.json) | 2026-10-05T01:38:05.003Z | 8412ddf | 30 | 434 / 2808 | 84.54% | 333 / 2808 | 88.14% | 67 / 5616 | Início do histórico contínuo: detector atual e conjunto completo de gravações |

## Primeira × última: rodadas 1 e 2

Comparação sobre 30 gravações comuns, com o mesmo gabarito e as mesmas leituras.

**Comparação histórica provisória:** o relatório importado não contém hashes dos arquivos. A identidade dos WAVs não pode ser confirmada; a comparação considera os IDs e gabaritos registrados.

| Modo | Erros: primeira → última | Acerto: primeira → última | Variação (pontos percentuais) |
|---|---|---|---|
| sozinho | 434 → 434 | 84.54% → 84.54% | 0.00 |
| exercicio | 333 → 333 | 88.14% → 88.14% | 0.00 |

Os totais de rodadas com conjuntos diferentes não devem ser comparados diretamente. Risco é uma medida comparativa com notas esperadas deslocadas de propósito, não uma taxa absoluta de falsos positivos.

## Rastreabilidade

Cada rodada nova registra commit, branch, parâmetros, hash do código e dependências, hashes de WAV + JSON, erros por gravação/modo/leitura e risco. `alterado: null` significa que Git não estava disponível para verificar alterações; o hash registra o conteúdo efetivamente testado.

Esta é uma avaliação offline de gravações reais. A suíte de regressão e a validação ao vivo são verificações adicionais. A linha de base anterior ao histórico está em [inicial-35ce63a.json](../inicial-35ce63a.json), apenas no modo sozinho.
