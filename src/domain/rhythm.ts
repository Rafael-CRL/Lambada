/**
 * Figuras rítmicas em 4/4 e gerador de compassos por células.
 * Um compasso é preenchido com células que respeitam onde cada figura
 * costuma começar (mínima no 1º ou 3º tempo, semibreve no 1º, ...).
 */

export type Figure = 'whole' | 'dotted-half' | 'half' | 'quarter' | 'eighth'

export const FIGURE_BEATS: Record<Figure, number> = {
  whole: 4,
  'dotted-half': 3,
  half: 2,
  quarter: 1,
  eighth: 0.5,
}

export const FIGURE_NAMES: Record<Figure, string> = {
  whole: 'semibreve',
  'dotted-half': 'mínima pontuada',
  half: 'mínima',
  quarter: 'semínima',
  eighth: 'colcheia',
}

export interface RhythmEvent {
  figure: Figure
  rest: boolean
  /** posição no compasso, em tempos (0 = cabeça do compasso) */
  beatInBar: number
  /** colcheias ligadas em par: 'start' na primeira, 'end' na segunda */
  beam?: 'start' | 'end'
}

export type RhythmLevel = 1 | 2 | 3 | 4 | 5

export const RHYTHM_LEVELS: { level: RhythmLevel; label: string }[] = [
  { level: 1, label: 'semínimas' },
  { level: 2, label: '+ mínimas' },
  { level: 3, label: '+ semibreve e mínima pontuada' },
  { level: 4, label: '+ colcheias' },
  { level: 5, label: '+ pausas' },
]

interface Cell {
  events: Omit<RhythmEvent, 'beatInBar'>[]
  beats: number
  /** tempos do compasso onde a célula pode começar */
  starts: number[]
  weight: number
  minLevel: RhythmLevel
}

const CELLS: Cell[] = [
  { events: [{ figure: 'quarter', rest: false }], beats: 1, starts: [0, 1, 2, 3], weight: 4, minLevel: 1 },
  { events: [{ figure: 'half', rest: false }], beats: 2, starts: [0, 2], weight: 2.2, minLevel: 2 },
  { events: [{ figure: 'whole', rest: false }], beats: 4, starts: [0], weight: 0.8, minLevel: 3 },
  { events: [{ figure: 'dotted-half', rest: false }], beats: 3, starts: [0], weight: 1, minLevel: 3 },
  {
    events: [
      { figure: 'eighth', rest: false, beam: 'start' },
      { figure: 'eighth', rest: false, beam: 'end' },
    ],
    beats: 1,
    starts: [0, 1, 2, 3],
    weight: 2.4,
    minLevel: 4,
  },
  { events: [{ figure: 'quarter', rest: true }], beats: 1, starts: [1, 2, 3], weight: 1, minLevel: 5 },
  { events: [{ figure: 'half', rest: true }], beats: 2, starts: [2], weight: 0.5, minLevel: 5 },
]

/**
 * Peso das células: figuras recém-introduzidas no nível ganham destaque,
 * para o nível escolhido ser de fato praticado.
 */
function cellWeight(cell: Cell, level: RhythmLevel): number {
  return cell.minLevel === level && level > 1 ? cell.weight * 2 : cell.weight
}

export function generateBar(level: RhythmLevel, rng: () => number = Math.random, beatsPerBar = 4): RhythmEvent[] {
  const out: RhythmEvent[] = []
  let beat = 0
  while (beat < beatsPerBar) {
    const fits = CELLS.filter(
      (c) =>
        c.minLevel <= level &&
        c.starts.includes(beat) &&
        beat + c.beats <= beatsPerBar &&
        // nada de duas pausas seguidas
        !(c.events[0].rest && out.length > 0 && out[out.length - 1].rest),
    )
    const total = fits.reduce((s, c) => s + cellWeight(c, level), 0)
    let r = rng() * total
    let cell = fits[fits.length - 1]
    for (const c of fits) {
      r -= cellWeight(c, level)
      if (r < 0) {
        cell = c
        break
      }
    }
    let b = beat
    for (const e of cell.events) {
      out.push({ ...e, beatInBar: b })
      b += FIGURE_BEATS[e.figure]
    }
    beat += cell.beats
  }
  return out
}

export function barBeats(events: RhythmEvent[]): number {
  return events.reduce((s, e) => s + FIGURE_BEATS[e.figure], 0)
}
