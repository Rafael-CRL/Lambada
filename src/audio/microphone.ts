import { DETECTION } from '../config'
import { midiOf, midiToFreq, parseNote } from '../domain/notes'
import { audioContext, outputLatency, recreateAudioContext } from './clock'
import { createPitchDetector } from './pitch'
import { NoteTracker, type LiveReading, type TrackerEvent } from './tracker'

/**
 * Captura do microfone: getUserMedia sem processamento → AnalyserNode, lido
 * a cada frame pelo loop do exercício. Os eventos saem no domínio de `clock()`.
 */
export class Microphone {
  private buffer: Float32Array<ArrayBuffer>
  private tracker: NoteTracker
  /** s a subtrair do tempo de contexto para chegar ao relógio do app */
  readonly compensation: number

  private constructor(
    private source: AudioNode,
    private analyser: AnalyserNode,
    private stream: MediaStream | null,
    inputLatency: number,
    userLatencyMs: number,
  ) {
    const ctx = audioContext()
    this.buffer = new Float32Array(analyser.fftSize)
    this.tracker = new NoteTracker(createPitchDetector(), ctx.sampleRate)
    this.compensation = outputLatency() + inputLatency + userLatencyMs / 1000
  }

  static async open(deviceId: string, userLatencyMs: number): Promise<Microphone> {
    let ctx = audioContext()
    let analyser = createAnalyser(ctx)

    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fakemic')) {
      const fake = createFakeGuitar(ctx)
      fake.connect(analyser)
      return new Microphone(fake, analyser, null, 0, userLatencyMs)
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    const track = stream.getAudioTracks()[0]
    const settings = track.getSettings() as MediaTrackSettings & { latency?: number }
    let source: MediaStreamAudioSourceNode
    try {
      source = ctx.createMediaStreamSource(stream)
    } catch (e) {
      if (!settings.sampleRate || settings.sampleRate === ctx.sampleRate) throw e
      ctx = await recreateAudioContext(settings.sampleRate)
      analyser = createAnalyser(ctx)
      source = ctx.createMediaStreamSource(stream)
    }
    source.connect(analyser)
    return new Microphone(source, analyser, stream, settings.latency ?? 0, userLatencyMs)
  }

  get live(): LiveReading {
    return this.tracker.live
  }

  get label(): string {
    return this.stream?.getAudioTracks()[0]?.label ?? 'violão simulado'
  }

  /**
   * Lê o analisador e devolve os eventos novos (tempos no relógio do app).
   * `expected`: a nota (MIDI soando) que o exercício espera agora, se houver.
   */
  poll(expected: number | null = null): TrackerEvent[] {
    const ctx = audioContext()
    this.tracker.expected = expected
    this.analyser.getFloatTimeDomainData(this.buffer)
    const events = this.tracker.process(this.buffer, ctx.currentTime)
    const c = this.compensation
    for (const e of events) {
      e.time -= c
      if (e.type === 'note') e.onsetTime -= c
    }
    return events
  }

  /** Liga a entrada crua (a mesma que o detector ouve) a outro nó: o gravador de testes. */
  tap(node: AudioNode): () => void {
    this.source.connect(node)
    return () => this.source.disconnect(node)
  }

  close() {
    this.source.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
  }
}

function createAnalyser(ctx: AudioContext): AnalyserNode {
  const analyser = ctx.createAnalyser()
  analyser.fftSize = DETECTION.bufferSize
  analyser.smoothingTimeConstant = 0
  return analyser
}

export async function listInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter((d) => d.kind === 'audioinput')
}

export function micSupported(): boolean {
  return !!navigator.mediaDevices?.getUserMedia
}

/**
 * Só em desenvolvimento (`?fakemic`): um "violão" sintético controlado por
 * `window.lambadaPluck('E2')` (nota soando), para testar o fluxo sem instrumento.
 */
function createFakeGuitar(ctx: AudioContext): AudioNode {
  const bus = ctx.createGain()
  ;(window as unknown as { lambadaPluck: (id: string, delay?: number) => void }).lambadaPluck = (id, delay = 0) => {
    const f0 = midiToFreq(midiOf(parseNote(id)))
    const t0 = ctx.currentTime + delay
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(0.35, t0 + 0.004)
    env.gain.setTargetAtTime(0, t0 + 0.004, 0.5)
    env.connect(bus)
    for (let h = 1; h <= 5; h++) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.frequency.value = f0 * h
      g.gain.value = 1 / (h * 1.5)
      osc.connect(g).connect(env)
      osc.start(t0)
      osc.stop(t0 + 2.5)
    }
  }
  return bus
}
