import { describe, expect, test } from 'vitest'
import { barBeats, barCells, barFromCells, FIGURE_BEATS, generateBar, RHYTHM_LEVELS, type BarSpec, type CellId, type RhythmLevel } from './rhythm'

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
}

const bars = (spec: BarSpec, meter = 4, n = 400) => {
  const rng = seeded((typeof spec === 'number' ? spec : spec.cells.length) * 7 + meter)
  return Array.from({ length: n }, () => generateBar(spec, rng, meter))
}

const figs = (spec: BarSpec, meter = 4) => new Set(bars(spec, meter).flat().map((e) => (e.rest ? `rest-${e.figure}` : e.figure)))

describe('gerador de compassos', () => {
  test.each([1, 2, 3, 4, 5] as RhythmLevel[])('nível %i: todo compasso soma o compasso, figuras em ordem', (level) => {
    for (const meter of [2, 3, 4]) {
      for (const bar of bars(level, meter)) {
        expect(barBeats(bar)).toBe(meter)
        let beat = 0
        for (const e of bar) {
          expect(e.beatInBar).toBe(beat)
          beat += FIGURE_BEATS[e.figure]
        }
      }
    }
  })

  test('níveis na ordem da trilha: semínima, + mínima e semibreve, + pausas, + colcheias, + pontuadas', () => {
    expect([...figs(1)]).toEqual(['quarter'])
    expect([...figs(2)].sort()).toEqual(['half', 'quarter', 'whole'])
    expect(figs(3).has('rest-quarter')).toBe(true)
    expect(figs(3).has('eighth')).toBe(false)
    expect(figs(4).has('eighth')).toBe(true)
    expect(figs(4).has('dotted-half')).toBe(false)
    expect(figs(5).has('dotted-half')).toBe(true)
    expect(figs(5).has('dotted-quarter')).toBe(true)
    expect(RHYTHM_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5])
  })

  test('posições sensatas: mínima no 1º/3º tempo, semibreve e pontuada no 1º, colcheias em pares', () => {
    for (const bar of bars(5)) {
      bar.forEach((e, i) => {
        if (e.figure === 'half') expect([0, 2]).toContain(e.beatInBar)
        if (e.figure === 'whole' || e.figure === 'dotted-half') expect(e.beatInBar).toBe(0)
        if (e.beam === 'start') expect(bar[i + 1].beam).toBe('end')
        if (e.figure === 'dotted-quarter') expect(bar[i + 1].figure).toBe('eighth')
        if (e.rest && i > 0) expect(bar[i - 1].rest).toBe(false)
      })
      expect(bar[0].rest).toBe(false)
    }
  })

  test('3/4 sem semibreve; 2/4 sem semibreve nem pontuada', () => {
    expect(figs(5, 3).has('whole')).toBe(false)
    expect(figs(5, 3).has('dotted-half')).toBe(true)
    expect(figs(5, 2).has('whole')).toBe(false)
    expect(figs(5, 2).has('dotted-half')).toBe(false)
  })

  test('conjunto de células da lição, com destaque para a figura nova', () => {
    const spec = { cells: ['q', 'h'] as CellId[], focus: ['h'] as CellId[] }
    const all = bars(spec).flat()
    expect(new Set(all.map((e) => e.figure))).toEqual(new Set(['quarter', 'half']))
    const halves = all.filter((e) => e.figure === 'half').length
    expect(halves).toBeGreaterThan(all.length * 0.2)
  })

  test('pausa de compasso inteiro só quando pedida', () => {
    expect(bars({ cells: ['q', 'h', 'wr'] }).some((b) => b.length === 1 && b[0].rest)).toBe(true)
    expect(figs(5).has('rest-whole')).toBe(false)
  })
})

describe('células ↔ compasso', () => {
  test('ida e volta', () => {
    for (const bar of bars(5)) expect(barFromCells(barCells(bar))).toEqual(bar)
  })

  test('colcheias em par e semínima pontuada + colcheia viram uma célula', () => {
    expect(barCells(barFromCells(['ee', 'dqe', 'q']))).toEqual(['ee', 'dqe', 'q'])
  })
})
