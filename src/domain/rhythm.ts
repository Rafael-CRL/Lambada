/**
 * Figuras rítmicas e gerador de compassos por células (2/4, 3/4 e 4/4).
 * Um compasso é preenchido com células que respeitam onde cada figura
 * costuma começar (mínima no 1º ou 3º tempo, semibreve no 1º, ...).
 */

export type Figure = 'whole' | 'dotted-half' | 'half' | 'dotted-quarter' | 'quarter' | 'eighth'

export const FIGURE_BEATS: Record<Figure, number> = {
  whole: 4,
  'dotted-half': 3,
  half: 2,
  'dotted-quarter': 1.5,
  quarter: 1,
  eighth: 0.5,
}

export const FIGURE_NAMES: Record<Figure, string> = {
  whole: 'semibreve',
  'dotted-half': 'mínima pontuada',
  half: 'mínima',
  'dotted-quarter': 'semínima pontuada',
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

/** Pulsos por compasso (a semínima vale 1 pulso: 2/4, 3/4, 4/4). */
export type Meter = 2 | 3 | 4

/**
 * Células: q semínima, h mínima, w semibreve, dh mínima pontuada, ee par de
 * colcheias, dqe semínima pontuada + colcheia, qr/hr/wr pausas de semínima,
 * mínima e semibreve (esta, o compasso inteiro).
 */
export type CellId = 'q' | 'h' | 'w' | 'dh' | 'ee' | 'dqe' | 'qr' | 'hr' | 'wr'

interface Cell {
  events: Omit<RhythmEvent, 'beatInBar'>[]
  beats: number
  /** pode começar neste tempo de um compasso de `meter` pulsos? */
  starts: (beat: number, meter: number) => boolean
  weight: number
}

const CELLS: Record<CellId, Cell> = {
  q: { events: [{ figure: 'quarter', rest: false }], beats: 1, starts: () => true, weight: 4 },
  // mínima no 1º ou no 3º tempo; no 3/4 também no 2º (semínima + mínima)
  h: { events: [{ figure: 'half', rest: false }], beats: 2, starts: (b, m) => b % 2 === 0 || m === 3, weight: 2.2 },
  w: { events: [{ figure: 'whole', rest: false }], beats: 4, starts: (b) => b === 0, weight: 0.8 },
  dh: { events: [{ figure: 'dotted-half', rest: false }], beats: 3, starts: (b) => b === 0, weight: 1 },
  ee: {
    events: [
      { figure: 'eighth', rest: false, beam: 'start' },
      { figure: 'eighth', rest: false, beam: 'end' },
    ],
    beats: 1,
    starts: () => true,
    weight: 2.4,
  },
  dqe: {
    events: [
      { figure: 'dotted-quarter', rest: false },
      { figure: 'eighth', rest: false },
    ],
    beats: 2,
    starts: (b) => b % 2 === 0,
    weight: 1.2,
  },
  // pausas nunca abrem o compasso (menos a de compasso inteiro)
  qr: { events: [{ figure: 'quarter', rest: true }], beats: 1, starts: (b) => b > 0, weight: 1 },
  hr: { events: [{ figure: 'half', rest: true }], beats: 2, starts: (b, m) => b > 0 && (b % 2 === 0 || m === 3), weight: 0.5 },
  wr: { events: [{ figure: 'whole', rest: true }], beats: 4, starts: (b) => b === 0, weight: 0.6 },
}

export const CELL_IDS = Object.keys(CELLS) as CellId[]

export function cellBeats(id: CellId): number {
  return CELLS[id].beats
}

export function cellEvents(id: CellId): Omit<RhythmEvent, 'beatInBar'>[] {
  return CELLS[id].events
}

export function isRestCell(id: CellId): boolean {
  return CELLS[id].events.every((e) => e.rest)
}

export type RhythmLevel = 1 | 2 | 3 | 4 | 5

/** Níveis de figuras, na mesma ordem da trilha da Teoria. */
export const RHYTHM_LEVELS: { level: RhythmLevel; label: string; cells: CellId[] }[] = [
  { level: 1, label: 'semínimas', cells: ['q'] },
  { level: 2, label: '+ mínimas e semibreves', cells: ['q', 'h', 'w'] },
  { level: 3, label: '+ pausas', cells: ['q', 'h', 'w', 'qr', 'hr'] },
  { level: 4, label: '+ colcheias', cells: ['q', 'h', 'w', 'qr', 'hr', 'ee'] },
  { level: 5, label: '+ pontuadas', cells: ['q', 'h', 'w', 'qr', 'hr', 'ee', 'dh', 'dqe'] },
]

/** O que entra num compasso: um nível pronto ou um conjunto de células (lições). */
export type BarSpec = RhythmLevel | { cells: CellId[]; focus?: CellId[] }

function resolve(spec: BarSpec): { cells: CellId[]; focus: CellId[] } {
  if (typeof spec !== 'number') return { cells: spec.cells, focus: spec.focus ?? [] }
  const cells = RHYTHM_LEVELS[spec - 1].cells
  // figuras recém-introduzidas no nível ganham destaque, para o nível ser de fato praticado
  const prev = spec > 1 ? RHYTHM_LEVELS[spec - 2].cells : []
  return { cells, focus: spec > 1 ? cells.filter((c) => !prev.includes(c)) : [] }
}

export function generateBar(spec: BarSpec, rng: () => number = Math.random, beatsPerBar: number = 4): RhythmEvent[] {
  const { cells, focus } = resolve(spec)
  const weight = (id: CellId) => CELLS[id].weight * (focus.includes(id) ? 2 : 1)
  const out: RhythmEvent[] = []
  let beat = 0
  while (beat < beatsPerBar) {
    const fits = cells.filter((id) => {
      const c = CELLS[id]
      return (
        c.starts(beat, beatsPerBar) &&
        beat + c.beats <= beatsPerBar &&
        // nada de duas pausas seguidas
        !(c.events[0].rest && out.length > 0 && out[out.length - 1].rest)
      )
    })
    // sem célula que caiba (conjunto sem semínima): completa com semínimas
    if (fits.length === 0) fits.push('q')
    const total = fits.reduce((s, id) => s + weight(id), 0)
    let r = rng() * total
    let pick = fits[fits.length - 1]
    for (const id of fits) {
      r -= weight(id)
      if (r < 0) {
        pick = id
        break
      }
    }
    let b = beat
    for (const e of CELLS[pick].events) {
      out.push({ ...e, beatInBar: b })
      b += FIGURE_BEATS[e.figure]
    }
    beat += CELLS[pick].beats
  }
  return out
}

/** Célula de cada grupo de eventos de um compasso (para comparar e escrever). */
export function barCells(events: RhythmEvent[]): CellId[] {
  const out: CellId[] = []
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.beam === 'start') {
      out.push('ee')
      i++
    } else if (e.figure === 'dotted-quarter' && events[i + 1]?.figure === 'eighth' && !e.rest) {
      out.push('dqe')
      i++
    } else {
      const id = CELL_IDS.find((c) => {
        const ev = CELLS[c].events
        return ev.length === 1 && ev[0].figure === e.figure && ev[0].rest === e.rest
      })
      if (!id) throw new Error(`figura sem célula: ${e.figure}`)
      out.push(id)
    }
  }
  return out
}

/** Eventos de um compasso a partir das células, em ordem. */
export function barFromCells(ids: CellId[]): RhythmEvent[] {
  const out: RhythmEvent[] = []
  let b = 0
  for (const id of ids)
    for (const e of CELLS[id].events) {
      out.push({ ...e, beatInBar: b })
      b += FIGURE_BEATS[e.figure]
    }
  return out
}

export function barBeats(events: RhythmEvent[]): number {
  return events.reduce((s, e) => s + FIGURE_BEATS[e.figure], 0)
}
