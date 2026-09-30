import { clarityThreshold, DETECTION } from '../config'
import { freqToMidiFloat } from '../domain/notes'
import type { PitchDetector } from './pitch'

/**
 * Transforma leituras sucessivas do microfone em eventos musicais:
 * ataque (onset), nota estável e fim da nota. Independe do Web Audio: recebe
 * o buffer e o tempo (relógio de áudio) de sua última amostra.
 */

export type TrackerEvent =
  | { type: 'onset'; time: number }
  | {
      type: 'note'
      /** MIDI soando (inteiro) */
      midi: number
      freq: number
      cents: number
      /** momento do ataque que originou a nota (relógio de áudio) */
      onsetTime: number
      time: number
    }
  | { type: 'release'; time: number }

export interface LiveReading {
  /** nível de entrada 0–1 (escala em dB, suavizado) */
  level: number
  /** pitch válido nesta leitura, em MIDI fracionário soando */
  midi: number | null
  freq: number | null
  clarity: number
  /** última nota aceita e ainda soando */
  heldMidi: number | null
}

type Phase = 'idle' | 'attack' | 'tracking' | 'sustain'

export type DetectionParams = typeof DETECTION

function rms(buf: Float32Array, from: number, to: number): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / Math.max(1, to - from))
}

export class NoteTracker {
  private phase: Phase = 'idle'
  private recentHistory: number[] = []
  private lastTime: number | null = null
  private lastOnset = -Infinity
  private onsetTime = 0
  private candidate: number | null = null
  private candidateSince = 0
  private candidateFreq = 0
  private candidateCents = 0
  private misses = 0
  private heldMidi: number | null = null
  private meter = 0
  /** ruído de fundo estimado (RMS) */
  private floor = 0
  /** nível de fim de nota desta leitura */
  private release = 0
  /**
   * Nota que o exercício espera agora (MIDI soando), se souber. Ela é aceita
   * com menos clareza e não cede a uma leitura intrusa isolada: com outra corda
   * soando junto, a leitura alterna entre a nota e a mistura.
   */
  expected: number | null = null
  readonly live: LiveReading = { level: 0, midi: null, freq: null, clarity: 0, heldMidi: null }

  constructor(
    private detector: PitchDetector,
    private sampleRate: number,
    private p: DetectionParams = DETECTION,
  ) {}

  reset() {
    this.phase = 'idle'
    this.recentHistory = []
    this.lastTime = null
    this.candidate = null
    this.heldMidi = null
    this.misses = 0
    this.floor = 0
  }

  /** Processa uma leitura. `time` = instante da última amostra do buffer. */
  process(buf: Float32Array, time: number): TrackerEvent[] {
    const events: TrackerEvent[] = []
    const n = buf.length
    const block = this.p.energyBlock
    const recent = rms(buf, n - 2 * block, n)
    const dt = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime)
    const newSamples = this.lastTime === null ? n : Math.min(n, Math.round(dt * this.sampleRate))
    this.lastTime = time

    // ruído de fundo: desce na hora com o som e sobe devagar (só o silêncio
    // entre as notas o puxa para baixo); o fim da nota fica logo acima dele.
    // Uma travada longa (aba em segundo plano) não conta como tempo de subida:
    // senão o ruído pula para o nível da nota que estiver soando.
    const rise = this.p.floorRise * Math.min(dt, 0.1)
    this.floor = this.floor === 0 || recent < this.floor ? recent : Math.min(recent, this.floor * (1 + rise))
    const release = Math.max(this.p.releaseRms, this.floor * this.p.releaseOverFloor)
    this.release = release

    // nível para o indicador
    const whole = rms(buf, 0, n)
    const db = 20 * Math.log10(whole + 1e-9)
    const target = Math.min(1, Math.max(0, (db + 60) / 60))
    this.meter = target > this.meter ? target : this.meter * this.p.meterSmoothing + target * (1 - this.p.meterSmoothing)
    this.live.level = this.meter

    // --- ataque: salto de energia em relação às leituras anteriores
    const reference = this.recentHistory.length ? Math.min(...this.recentHistory) : 0
    const isOnset =
      recent >= this.p.onsetMinRms &&
      recent > Math.max(reference, release / 2) * this.p.onsetRatio &&
      time - this.lastOnset >= this.p.onsetRefractory &&
      (this.p.onsetSharpness <= 0 || this.sharpness(buf, newSamples) >= this.p.onsetSharpness)
    this.recentHistory.push(recent)
    if (this.recentHistory.length > 3) this.recentHistory.shift()

    if (isOnset) {
      const onset = this.locateOnset(buf, newSamples, reference, time)
      this.lastOnset = time
      this.onsetTime = onset
      this.phase = 'attack'
      this.candidate = null
      this.misses = 0
      events.push({ type: 'onset', time: onset })
    } else if (this.phase !== 'idle' && recent < release) {
      this.phase = 'idle'
      this.candidate = null
      this.heldMidi = null
      // o ataque que acabou era ruído (o dedo preparando o toque): o toque de verdade vem logo depois
      this.lastOnset = -Infinity
      events.push({ type: 'release', time })
    }

    // --- pitch
    let reading: { midi: number; freq: number; clarity: number } | null = null
    const ignoring = this.phase === 'attack' && time - this.onsetTime < this.p.attackIgnore
    if (!ignoring && recent >= release) {
      const r = this.detector.detect(buf, this.sampleRate)
      if (r && r.freq >= this.p.minFreq && r.freq <= this.p.maxFreq) {
        const midi = freqToMidiFloat(r.freq)
        let min = clarityThreshold(r.freq, this.p.clarity)
        if (Math.round(midi) === this.expected) min = Math.min(min, this.p.expectedClarity)
        if (r.clarity >= min) reading = { midi, freq: r.freq, clarity: r.clarity }
      }
    }
    this.live.midi = reading?.midi ?? null
    this.live.freq = reading?.freq ?? null
    this.live.clarity = reading?.clarity ?? 0

    if (this.phase === 'attack' && !ignoring) this.phase = 'tracking'

    // Só um ataque abre uma nota. Uma nota diferente sem ataque (outra corda
    // soando, dedo esbarrando) não conta: nas gravações reais isso só gerava
    // notas a mais. Ligados vão precisar de outro sinal de ataque.
    if (this.phase === 'tracking') {
      const nearest = reading ? Math.round(reading.midi) : null
      const cents = reading && nearest !== null ? (reading.midi - nearest) * 100 : 0
      const usable = nearest !== null && Math.abs(cents) <= this.p.centsTolerance
      if (usable && nearest === this.candidate) {
        this.misses = 0
        this.candidateFreq = reading!.freq
        this.candidateCents = cents
      } else if (usable && this.candidate !== null && this.candidate === this.expected && ++this.misses <= 1) {
        // a nota esperada não cede a uma leitura intrusa isolada (mistura com
        // outra corda soando)
      } else if (usable) {
        this.candidate = nearest
        this.candidateSince = time
        this.candidateFreq = reading!.freq
        this.candidateCents = cents
        this.misses = 0
      } else if (++this.misses > 1) {
        this.candidate = null
      }

      const stable = this.candidate === this.expected ? this.p.expectedStableTime : this.p.stableTime
      if (this.candidate !== null && time - this.candidateSince >= stable) {
        events.push({
          type: 'note',
          midi: this.candidate,
          freq: this.candidateFreq,
          cents: this.candidateCents,
          onsetTime: this.onsetTime,
          time,
        })
        this.heldMidi = this.candidate
        this.phase = 'sustain'
      }
    }
    this.live.heldMidi = this.heldMidi
    return events
  }

  /**
   * Quão abrupta é a subida de energia nas amostras novas: a maior razão entre
   * dois blocos vizinhos de ~10 ms. Um toque salta de uma vez; a nota que só
   * incha (corda encostada e solta, batimento) sobe devagar. Medido dentro da
   * janela, não depende da taxa de leitura.
   */
  private sharpness(buf: Float32Array, newSamples: number): number {
    const n = buf.length
    const b = this.p.sharpBlock
    let best = 0
    for (let i = Math.max(b, n - newSamples - b); i + b <= n; i += 64) {
      const before = rms(buf, i - b, i)
      const after = rms(buf, i, i + b)
      best = Math.max(best, after / Math.max(before, this.release / 4))
    }
    return best
  }

  /** Estima o instante do ataque dentro das amostras novas deste buffer. */
  private locateOnset(buf: Float32Array, newSamples: number, reference: number, time: number): number {
    const n = buf.length
    const start = Math.max(0, n - newSamples)
    const step = 64
    const threshold = Math.max(this.p.onsetMinRms / 2, reference * this.p.onsetRatio * 0.5)
    for (let i = start; i + step <= n; i += step) {
      if (rms(buf, i, i + step) >= threshold) return time - (n - i) / this.sampleRate
    }
    return time
  }
}
