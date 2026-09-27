import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BPM } from '../config'

// AudioContext falso: só o necessário para o agendador
const started: { t: number; accent: boolean }[] = []
const fakeCtx = {
  currentTime: 0,
  sampleRate: 48000,
  destination: {},
  createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length), tag: length }),
  createGain: () => ({ gain: { value: 1 }, connect: () => {}, disconnect: () => {} }),
  createBufferSource() {
    const node = {
      buffer: null as unknown,
      onended: null,
      connect: () => {},
      start: (t: number) => started.push({ t, accent: node.buffer === accentBuffer }),
      stop: () => {},
    }
    return node
  },
}
let accentBuffer: unknown = null

vi.mock('../audio/clock', () => ({ audioContext: () => fakeCtx }))

const { Metronome } = await import('../audio/metronome')
const { multiplierFor, scoreHit } = await import('./bpm')

describe('pontuação', () => {
  test('nota certa no tempo vale base + precisão', () => {
    expect(scoreHit(0, 0.12, 1)).toBe(BPM.hitPoints + BPM.timingPoints)
    expect(scoreHit(0.06, 0.12, 1)).toBe(BPM.hitPoints + BPM.timingPoints / 2)
    expect(scoreHit(-0.12, 0.12, 1)).toBe(BPM.hitPoints)
    expect(scoreHit(0, 0.12, 2)).toBe(2 * (BPM.hitPoints + BPM.timingPoints))
  })

  test('multiplicador sobe com o combo até o teto', () => {
    expect(multiplierFor(0)).toBe(1)
    expect(multiplierFor(BPM.comboStep - 1)).toBe(1)
    expect(multiplierFor(BPM.comboStep)).toBe(2)
    expect(multiplierFor(1000)).toBe(BPM.maxMultiplier)
  })
})

describe('metrônomo (agendador com lookahead)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', globalThis)
    started.length = 0
    fakeCtx.currentTime = 10
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('agenda cada clique no relógio de áudio, só dentro do lookahead', () => {
    const m = new Metronome(120)
    accentBuffer = (m as unknown as { clicks: { accent: unknown } }).clicks.accent
    // tempo 0 em 12.05; a contagem (-4..-1) começa em 10.05
    m.start(12.05, -4, 3)
    // só 10.05 está dentro de 10 + 0.1
    expect(started.map((s) => s.t)).toEqual([10.05])

    // o relógio de áudio avança; o timer só acorda o agendador
    for (let i = 0; i < 200; i++) {
      fakeCtx.currentTime += BPM.schedulerInterval
      vi.advanceTimersByTime(BPM.schedulerInterval * 1000)
    }
    const times = started.map((s) => +s.t.toFixed(3))
    expect(times).toEqual([10.05, 10.55, 11.05, 11.55, 12.05, 12.55, 13.05, 13.55])
    // acentos no primeiro tempo do compasso (índices -4 e 0)
    expect(started.map((s) => s.accent)).toEqual([true, false, false, false, true, false, false, false])
    m.dispose()
  })

  test('parar interrompe o agendamento', () => {
    const m = new Metronome(60)
    m.start(10.05)
    m.stop()
    fakeCtx.currentTime += 5
    vi.advanceTimersByTime(5000)
    expect(started).toHaveLength(1)
  })
})
