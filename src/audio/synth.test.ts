import { describe, expect, test } from 'vitest'
import { freqToMidiFloat, midiOf, parseNote } from '../domain/notes'
import { createPitchDetector } from './pitch'
import { renderPiano, renderPluck } from './synth'

const SR = 48000
const fakeCtx = {
  sampleRate: SR,
  createBuffer: (_ch: number, length: number) => {
    const data = new Float32Array(length)
    return { getChannelData: () => data, length }
  },
} as unknown as BaseAudioContext

describe('som de corda sintetizado', () => {
  test.each(['E2', 'A2', 'G3', 'B3', 'E4', 'G4', 'E5'])('%s soa na altura certa', (id) => {
    const buf = renderPluck(fakeCtx, midiOf(parseNote(id)))
    const data = buf.getChannelData(0)
    const window = data.slice(Math.round(0.1 * SR), Math.round(0.1 * SR) + 4096)
    const r = createPitchDetector().detect(window, SR)!
    const cents = (freqToMidiFloat(r.freq) - midiOf(parseNote(id))) * 100
    expect(Math.abs(cents)).toBeLessThan(6)
  })

  test.each(['E2', 'G3', 'E4', 'G4'])('piano %s soa na altura certa', (id) => {
    const data = renderPiano(fakeCtx, midiOf(parseNote(id))).getChannelData(0)
    const r = createPitchDetector().detect(data.slice(Math.round(0.1 * SR), Math.round(0.1 * SR) + 4096), SR)!
    expect(Math.abs((freqToMidiFloat(r.freq) - midiOf(parseNote(id))) * 100)).toBeLessThan(10)
  })

  test('decai e não estoura', () => {
    const data = renderPluck(fakeCtx, midiOf(parseNote('D3'))).getChannelData(0)
    const peak = (a: number, b: number) => data.slice(a, b).reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    expect(peak(0, data.length)).toBeLessThanOrEqual(0.61)
    expect(peak(data.length - 2000, data.length)).toBeLessThan(0.01)
  })
})
