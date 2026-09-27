import { describe, expect, test } from 'vitest'
import { barBeats, FIGURE_BEATS, generateBar, type RhythmLevel } from './rhythm'

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

const bars = (level: RhythmLevel, n = 400) => {
  const rng = seeded(level * 7 + 1)
  return Array.from({ length: n }, () => generateBar(level, rng))
}

describe('gerador de compassos', () => {
  test.each([1, 2, 3, 4, 5] as RhythmLevel[])('nível %i: todo compasso soma 4 tempos', (level) => {
    for (const bar of bars(level)) {
      expect(barBeats(bar)).toBe(4)
      let beat = 0
      for (const e of bar) {
        expect(e.beatInBar).toBe(beat)
        beat += FIGURE_BEATS[e.figure]
      }
    }
  })

  test('cada nível usa só as figuras dele', () => {
    const figs = (level: RhythmLevel) => new Set(bars(level).flat().map((e) => (e.rest ? `rest-${e.figure}` : e.figure)))
    expect([...figs(1)]).toEqual(['quarter'])
    expect([...figs(2)].sort()).toEqual(['half', 'quarter'])
    expect([...figs(3)].sort()).toEqual(['dotted-half', 'half', 'quarter', 'whole'])
    expect(figs(4).has('eighth')).toBe(true)
    expect(figs(4).has('rest-quarter')).toBe(false)
    expect(figs(5).has('rest-quarter')).toBe(true)
  })

  test('posições sensatas: mínima no 1º/3º tempo, semibreve e pontuada no 1º, colcheias em pares', () => {
    for (const bar of bars(5)) {
      bar.forEach((e, i) => {
        if (e.figure === 'half') expect([0, 2]).toContain(e.beatInBar)
        if (e.figure === 'whole' || e.figure === 'dotted-half') expect(e.beatInBar).toBe(0)
        if (e.beam === 'start') expect(bar[i + 1].beam).toBe('end')
        if (e.rest && i > 0) expect(bar[i - 1].rest).toBe(false)
      })
      expect(bar[0].rest).toBe(false)
    }
  })
})
