import { audioContext } from '../audio/clock'
import type { Microphone } from '../audio/microphone'

/**
 * Captura contínua da entrada do microfone (todas as amostras, mixadas em
 * mono como o AnalyserNode faz), num AudioWorklet. Só para gravar os testes
 * do detector.
 */

const PROCESSOR = `
class Capture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.on = false
    this.chunk = []
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.first = true }
      else { this.flush(); this.on = false; this.port.postMessage({ done: true }) }
    }
  }
  flush() {
    if (!this.chunk.length) return
    const data = new Float32Array(this.chunk.length * this.chunk[0].length)
    this.chunk.forEach((b, i) => data.set(b, i * b.length))
    this.port.postMessage({ data }, [data.buffer])
    this.chunk = []
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0]
    if (this.on && input) {
      if (this.first) { this.port.postMessage({ start: currentTime }); this.first = false }
      this.chunk.push(input.slice())
      if (this.chunk.length >= 32) this.flush()
    }
    return true
  }
}
registerProcessor('lambada-capture', Capture)
`

/** o módulo é registrado por contexto (o Firefox recria o contexto ao trocar de microfone) */
const loaded = new WeakMap<AudioContext, Promise<void>>()

export interface Recording {
  samples: Float32Array
  sampleRate: number
  /** instante (tempo de contexto) da primeira amostra */
  start: number
}

export class Capture {
  private chunks: Float32Array[] = []
  private start = 0
  private untap: () => void = () => {}

  private constructor(private node: AudioWorkletNode, private mute: GainNode) {}

  static async create(mic: Microphone): Promise<Capture> {
    const ctx = audioContext()
    let module = loaded.get(ctx)
    if (!module) {
      module = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([PROCESSOR], { type: 'text/javascript' })))
      loaded.set(ctx, module)
      module.catch(() => loaded.delete(ctx))
    }
    await module
    const node = new AudioWorkletNode(ctx, 'lambada-capture', {
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    // o nó só é processado ligado à saída; ganho zero para não tocar nada
    const mute = ctx.createGain()
    mute.gain.value = 0
    node.connect(mute).connect(ctx.destination)
    const c = new Capture(node, mute)
    c.untap = mic.tap(node)
    return c
  }

  begin() {
    this.chunks = []
    this.start = 0
    this.node.port.onmessage = (e) => {
      if (e.data.start !== undefined) this.start = e.data.start
      if (e.data.data) this.chunks.push(e.data.data)
    }
    this.node.port.postMessage('start')
  }

  end(): Promise<Recording> {
    return new Promise((resolve) => {
      const onData = this.node.port.onmessage!
      this.node.port.onmessage = (e) => {
        onData.call(this.node.port, e)
        if (!e.data.done) return
        const samples = new Float32Array(this.chunks.reduce((n, c) => n + c.length, 0))
        let at = 0
        for (const c of this.chunks) {
          samples.set(c, at)
          at += c.length
        }
        resolve({ samples, sampleRate: audioContext().sampleRate, start: this.start })
      }
      this.node.port.postMessage('stop')
    })
  }

  dispose() {
    this.untap()
    this.node.disconnect()
    this.mute.disconnect()
  }
}
