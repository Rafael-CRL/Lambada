import { BPM } from '../config'
import { audioContext } from './clock'

/**
 * Metrônomo com agendador de lookahead: o timer só acorda o agendador; cada
 * clique é agendado no relógio do AudioContext com start(time), ~100 ms à frente.
 */
export class Metronome {
  private timer: number | null = null
  private nextBeat = 0
  private lastBeat = Infinity
  private baseTime = 0
  private clicks: { accent: AudioBuffer; normal: AudioBuffer }
  private scheduled: AudioBufferSourceNode[] = []
  private out: GainNode

  constructor(
    readonly bpm: number,
    readonly beatsPerBar = BPM.beatsPerBar,
    volume = 0.6,
  ) {
    const ctx = audioContext()
    this.clicks = { accent: renderClick(ctx, 1760), normal: renderClick(ctx, 1175) }
    this.out = ctx.createGain()
    this.out.gain.value = volume
    this.out.connect(ctx.destination)
  }

  get secondsPerBeat(): number {
    return 60 / this.bpm
  }

  /** Instante (relógio de áudio) do tempo `i`; o tempo 0 cai em `baseTime`. */
  beatTime(i: number): number {
    return this.baseTime + i * this.secondsPerBeat
  }

  /**
   * Toca os tempos `from`..`to` (inclusive), com o tempo 0 em `baseTime`.
   * Índices negativos servem para a contagem; o acento cai nos múltiplos do compasso.
   */
  start(baseTime: number, from = 0, to = Infinity) {
    this.stop()
    this.baseTime = baseTime
    this.nextBeat = from
    this.lastBeat = to
    this.schedule()
    this.timer = window.setInterval(() => this.schedule(), BPM.schedulerInterval * 1000)
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    // cliques já agendados dentro do lookahead também param
    for (const src of this.scheduled) {
      try {
        src.stop()
      } catch {
        /* já tocou */
      }
    }
    this.scheduled = []
  }

  dispose() {
    this.stop()
    this.out.disconnect()
  }

  private schedule() {
    const ctx = audioContext()
    const horizon = ctx.currentTime + BPM.lookahead
    while (this.nextBeat <= this.lastBeat && this.beatTime(this.nextBeat) < horizon) {
      const t = this.beatTime(this.nextBeat)
      if (t >= ctx.currentTime - 0.01) {
        const src = ctx.createBufferSource()
        const inBar = ((this.nextBeat % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar
        src.buffer = inBar === 0 ? this.clicks.accent : this.clicks.normal
        src.connect(this.out)
        src.start(t)
        this.scheduled.push(src)
        src.onended = () => {
          this.scheduled = this.scheduled.filter((s) => s !== src)
        }
      }
      this.nextBeat++
    }
  }
}

function renderClick(ctx: AudioContext, freq: number): AudioBuffer {
  const length = Math.round(ctx.sampleRate * 0.035)
  const buf = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate
    const env = Math.min(1, t / 0.0008) * Math.exp(-t / 0.008)
    data[i] = env * (Math.sin(2 * Math.PI * freq * t) * 0.8 + Math.sin(2 * Math.PI * freq * 2.01 * t) * 0.2)
  }
  return buf
}
