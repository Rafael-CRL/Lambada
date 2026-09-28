/**
 * Parâmetros ajustáveis do app. Tudo que é limiar, peso ou constante de
 * calibração mora aqui para ser ajustado testando no violão real.
 */

export const DETECTION = {
  /** Tamanho da janela lida do AnalyserNode (amostras). */
  bufferSize: 2048,
  /** Faixa aceita (Hz): violão, casas 0–12, com folga. */
  minFreq: 75,
  maxFreq: 700,
  /** Limiar de clarity por faixa de frequência (pitchy/MPM). */
  clarity: [
    { below: 200, min: 0.9 },
    { below: 500, min: 0.86 },
    { below: Infinity, min: 0.8 },
  ],
  /** Tempo que a nota precisa ficar estável para ser aceita (s). */
  stableTime: 0.09,
  /** Tolerância de afinação para considerar "o mesmo semitom" (cents). */
  centsTolerance: 45,
  /** Ignorar o pitch logo após o ataque (s). */
  attackIgnore: 0.04,
  /** RMS mínimo para considerar um ataque. */
  onsetMinRms: 0.012,
  /** Salto relativo de energia que caracteriza um novo ataque. */
  onsetRatio: 1.9,
  /** Intervalo mínimo entre ataques (s). */
  onsetRefractory: 0.08,
  /** Abaixo disso a nota é considerada encerrada. */
  releaseRms: 0.006,
  /** Tamanho do bloco usado para medir energia recente e localizar o ataque. */
  energyBlock: 256,
  /** Suavização do nível mostrado no indicador (0–1, maior = mais lento). */
  meterSmoothing: 0.75,
} as const

export function clarityThreshold(freq: number): number {
  for (const band of DETECTION.clarity) if (freq < band.below) return band.min
  return DETECTION.clarity[DETECTION.clarity.length - 1].min
}

export const ADAPTIVE = {
  /** Janela móvel de tentativas usada para calcular domínio. */
  window: 10,
  /** Mínimo de tentativas na janela para declarar domínio. */
  minAttempts: 6,
  /** Acerto mínimo na janela. */
  masteryAccuracy: 0.85,
  /** Tempo mediano máximo (s) por tipo de entrada. */
  masteryMedianTime: { buttons: 2.0, mic: 3.0 },
  /** Notas ativas no início. */
  initialActive: 3,
  weights: {
    base: 1,
    /** multiplicado pela taxa de erro na janela */
    error: 4,
    /** multiplicado por (mediana / limite), limitado a 2 */
    slow: 1.5,
    /** notas com poucas tentativas aparecem mais */
    novelty: 1.5,
    /** fator aplicado a notas dominadas (continuam aparecendo, pouco) */
    masteredFactor: 0.2,
  },
} as const

/** Escolha da próxima nota (Leitura e Notas): saco embaralhado + reforço. */
export const PICKER = {
  /** tamanho do bloco da fila */
  block: 10,
  /** vagas de reforço (notas com erro recente) em cada bloco */
  weightedPerBlock: 3,
  /** quantas tentativas recentes de cada nota contam como "erro recente" */
  errorWindow: 10,
  /** máximo de reforços da mesma nota num bloco */
  capPerBlock: 1,
} as const

export const READING = {
  /** Espaço entre notas na esteira, em espaços de pauta. */
  conveyorGap: 7,
  /** Velocidade de aproximação no modo Espera (espaços de pauta/s). */
  waitSpeed: 26,
  /** Velocidade inicial no modo Contínua (espaços de pauta/s). */
  continuousSpeed: 3.2,
  continuousMinSpeed: 1.2,
  continuousMaxSpeed: 14,
  /** Acerto-alvo do modo Contínua. */
  continuousTarget: 0.9,
  /** Quantas respostas recentes entram no ajuste de velocidade. */
  continuousWindow: 10,
  /** Tempo mostrando o nome correto após erro (s). */
  revealTime: 0.9,
  sprintDuration: 60,
  /** Tempo de exibição do "acertou" antes da próxima no sprint (s). */
  sprintAdvanceDelay: 0.12,
} as const

/** Lições da trilha da Pauta. */
export const LESSON = {
  /** vezes que cada nota nova aparece seguida, com o nome */
  introRepeat: 3,
  /** idem quando a lição apresenta 3 ou mais notas novas */
  introRepeatMany: 2,
  /** opacidade da cola na parte "em ordem" (1 na apresentação, 0 no sorteio) */
  patternGuide: 0.4,
  /** no começo do sorteio a cola não some de uma vez: vai apagando ao longo destas notas */
  fadeNotes: 6,
  /** depois de um erro, a cola volta fraca nas notas seguintes e apaga de novo */
  supportNotes: 3,
  supportGuide: 0.3,
  /** espaço entre as notas, em espaços de pauta */
  gap: 7,
  /** tempo mostrando a resposta certa depois de um erro (s) */
  revealTime: 1.1,
  /** a nota errada volta tantas notas depois (só no sorteio) */
  retryAfter: 3,
  /** acerto mínimo (notas sem o nome) para marcar a lição como feita */
  pass: 0.9,
  /** parte do sorteio que revisa as etapas anteriores */
  review: 0.2,
  /** Desafio da etapa: notas e tempo médio máximo por nota (s) */
  challengeNotes: 20,
  challengeTime: 2,
  /** no violão (achar a casa e tocar leva mais tempo) */
  challengeTimeMic: 3,
  /** "treinar mais" no fim da lição */
  moreNotes: 10,
  /** dica: aparece com 2 erros seguidos ou `tipErrors` erros nas últimas `tipWindow` respostas */
  tipErrors: 3,
  tipWindow: 8,
  /** respostas mínimas entre duas dicas */
  tipGap: 8,
  /** a dica some depois de tantas respostas */
  tipLasts: 4,
} as const

/** Lições e prática de ritmo. */
export const RHYTHM = {
  /** andamento das lições (a semínima dura 1 s) */
  bpm: 60,
  /** compassos de contagem antes de cada trecho */
  countInBars: 1,
  /** folga (s) entre o fim do trecho e o começo do próximo */
  lead: 0.35,
  /** tempo mostrando as marcas de acerto/erro (s) */
  resultTime: 1.1,
  /** o trecho errado volta tantos itens depois (uma vez) */
  retryAfter: 2,
  /** altura do tom das figuras (Hz) */
  toneFreq: 440,
} as const

export const BPM = {
  beatsPerBar: 4,
  countInBars: 1,
  /** Espaços de pauta percorridos por tempo (mais largo quando há colcheias). */
  beatSpacing: 7,
  beatSpacingEighths: 9,
  /** Pontuação base por nota correta e bônus máximo por precisão. */
  hitPoints: 50,
  timingPoints: 50,
  /** A cada N acertos seguidos o multiplicador sobe 1 (até maxMultiplier). */
  comboStep: 8,
  maxMultiplier: 4,
  /** Agendador do metrônomo. */
  lookahead: 0.1,
  schedulerInterval: 0.025,
} as const

export const UI = {
  /** Duração das transições de feedback (ms). */
  feedbackMs: 160,
} as const
