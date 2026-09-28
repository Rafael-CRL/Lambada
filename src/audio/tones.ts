import { audioContext } from './clock'

/**
 * Som das figuras no ritmo: um tom que dura o valor da figura (a mínima soa
 * o dobro da semínima), agendado no relógio do AudioContext. Diferente do
 * clique do metrônomo, para os dois se distinguirem.
 */
export class ToneScheduler {
  private out: GainNode
  private nodes = new Set<OscillatorNode>()

  constructor(volume = 0.3) {
    const ctx = audioContext()
    this.out = ctx.createGain()
    this.out.gain.value = volume
    this.out.connect(ctx.destination)
  }

  /** Tom de `dur` segundos a partir de `time` (relógio do AudioContext). */
  schedule(time: number, dur: number, freq = 440) {
    const ctx = audioContext()
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const g = ctx.createGain()
    // ataque curto, cai um pouco e segura até perto do fim (as notas não se colam)
    const end = time + Math.max(0.08, dur - 0.05)
    g.gain.setValueAtTime(0, time)
    g.gain.linearRampToValueAtTime(1, time + 0.008)
    g.gain.setTargetAtTime(0.6, time + 0.008, 0.07)
    g.gain.setTargetAtTime(0, end, 0.015)
    osc.connect(g)
    g.connect(this.out)
    osc.start(time)
    osc.stop(end + 0.12)
    this.nodes.add(osc)
    osc.onended = () => {
      this.nodes.delete(osc)
      g.disconnect()
    }
  }

  stop() {
    for (const n of this.nodes) {
      try {
        n.stop()
      } catch {
        /* ainda não começou ou já parou */
      }
    }
    this.nodes.clear()
  }

  dispose() {
    this.stop()
    this.out.disconnect()
  }
}
