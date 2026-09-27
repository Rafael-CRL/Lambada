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

export const BPM = {
  beatsPerBar: 4,
  countInBars: 1,
  /** Espaços de pauta percorridos por tempo. */
  beatSpacing: 6,
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
