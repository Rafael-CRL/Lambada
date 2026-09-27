import { describe, expect, test } from 'vitest'
import { DETECTION } from '../config'
import { midiOf, midiToFreq, parseNote } from '../domain/notes'
import { createPitchDetector } from './pitch'
import { NoteTracker, type TrackerEvent } from './tracker'

const SR = 48000
/** ~60 fps de leitura do AnalyserNode */
const HOP = 800

interface Pluck {
  at: number
  note: string
  amp?: number
  decay?: number
  duration?: number
  cents?: number
  /** peso do fundamental (cordas graves costumam ter fundamental fraco) */
  fundamental?: number
}

/** Corda dedilhada sintética: harmônicos com decaimento e ataque de 3 ms. */
function render(plucks: Pluck[], seconds: number, noise = 0.0005): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR))
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < out.length; i++) out[i] = noise * rand()
  for (const p of plucks) {
    const f0 = midiToFreq(midiOf(parseNote(p.note)) + (p.cents ?? 0) / 100)
    const amp = p.amp ?? 0.3
    const decay = p.decay ?? 1.2
    const start = Math.round(p.at * SR)
    const end = Math.min(out.length, start + Math.round((p.duration ?? seconds) * SR))
    for (let i = start; i < end; i++) {
      const t = (i - start) / SR
      const env = Math.min(1, t / 0.003) * Math.exp(-t / decay) * (i > end - 480 ? (end - i) / 480 : 1)
      let s = 0
      for (let h = 1; h <= 6; h++) s += ((h === 1 ? (p.fundamental ?? 1) : 1) * Math.sin(2 * Math.PI * f0 * h * t)) / (h * 1.4)
      out[i] += amp * env * s
    }
  }
  return out
}

function run(signal: Float32Array, size: number = DETECTION.bufferSize): TrackerEvent[] {
  const tracker = new NoteTracker(createPitchDetector(), SR)
  const events: TrackerEvent[] = []
  for (let end = size; end <= signal.length; end += HOP) {
    events.push(...tracker.process(signal.subarray(end - size, end), end / SR))
  }
  return events
}

const notes = (ev: TrackerEvent[]) => ev.filter((e) => e.type === 'note') as Extract<TrackerEvent, { type: 'note' }>[]
const m = (id: string) => midiOf(parseNote(id))

describe('detecção de notas', () => {
  test.each(['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'G4', 'E5'])('reconhece %s', (id) => {
    const ev = run(render([{ at: 0.2, note: id }], 1))
    const n = notes(ev)
    expect(n).toHaveLength(1)
    expect(n[0].midi).toBe(m(id))
  })

  test('localiza o ataque com precisão e só aceita após estabilidade', () => {
    const ev = run(render([{ at: 0.3, note: 'A2' }], 1))
    const [n] = notes(ev)
    expect(Math.abs(n.onsetTime - 0.3)).toBeLessThan(0.006)
    expect(n.time - n.onsetTime).toBeGreaterThanOrEqual(DETECTION.attackIgnore + DETECTION.stableTime - 0.02)
    expect(n.time - n.onsetTime).toBeLessThan(0.25)
  })

  test('mesma nota tocada de novo gera novo evento', () => {
    const ev = run(render([{ at: 0.2, note: 'G3', decay: 2 }, { at: 0.7, note: 'G3', decay: 2 }], 1.3))
    const n = notes(ev)
    expect(n.map((x) => x.midi)).toEqual([m('G3'), m('G3')])
    expect(Math.abs(n[1].onsetTime - 0.7)).toBeLessThan(0.01)
  })

  test('sequência de notas diferentes', () => {
    const seq = ['E4', 'F4', 'G4', 'A3', 'C4']
    const ev = run(render(seq.map((note, i) => ({ at: 0.15 + i * 0.4, note, duration: 0.38 })), 2.3))
    expect(notes(ev).map((x) => x.midi)).toEqual(seq.map(m))
  })

  test('nota levemente desafinada ainda conta', () => {
    const n = notes(run(render([{ at: 0.2, note: 'D3', cents: 25 }], 0.8)))
    expect(n.map((x) => x.midi)).toEqual([m('D3')])
    expect(n[0].cents).toBeGreaterThan(15)
  })

  test('ruído não gera nota', () => {
    const noise = render([], 1, 0.05)
    expect(notes(run(noise))).toHaveLength(0)
  })

  test('fora da faixa do violão é descartado', () => {
    // ~1047 Hz: acima de maxFreq
    expect(notes(run(render([{ at: 0.2, note: 'C6' }], 0.8)))).toHaveLength(0)
  })

  test('fim da nota quando a energia cai', () => {
    const ev = run(render([{ at: 0.1, note: 'B3', duration: 0.4 }], 1))
    const release = ev.find((e) => e.type === 'release')
    expect(release).toBeDefined()
    expect(release!.time).toBeGreaterThan(0.5)
    expect(release!.time).toBeLessThan(0.6)
  })

  test('nota curta demais (antes da estabilidade) é ignorada', () => {
    expect(notes(run(render([{ at: 0.2, note: 'E4', duration: 0.06 }], 0.8)))).toHaveLength(0)
  })

  test('fundamental fraco não vira erro de oitava', () => {
    for (const note of ['E2', 'A2', 'D3']) {
      const n = notes(run(render([{ at: 0.2, note, fundamental: 0.3 }], 1)))
      expect(n.map((x) => x.midi)).toEqual([m(note)])
    }
  })

  test('buffer de 4096 também funciona', () => {
    const n = notes(run(render([{ at: 0.2, note: 'E2' }], 1), 4096))
    expect(n.map((x) => x.midi)).toEqual([m('E2')])
  })
})
