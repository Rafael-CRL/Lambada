import { barCells, FIGURE_BEATS, generateBar, type CellId, type Meter, type RhythmEvent } from '../domain/rhythm'

/** Um trecho de ritmo: alguns compassos num compasso x/4. */
export interface RhythmPattern {
  meter: Meter
  bars: RhythmEvent[][]
}

/** Figuras de uma lição: quais células entram, qual ganha destaque, quais não podem faltar. */
export interface CellSpec {
  cells: CellId[]
  focus?: CellId[]
  /** cada trecho tem pelo menos uma destas (a figura da lição) */
  must?: CellId[]
}

/** Evento com a posição absoluta no trecho, em pulsos. */
export interface PlacedEvent extends RhythmEvent {
  beat: number
  bar: number
  /** índice no trecho (todos os eventos, com pausas) */
  index: number
}

export function placed(p: RhythmPattern): PlacedEvent[] {
  const out: PlacedEvent[] = []
  p.bars.forEach((bar, b) => bar.forEach((e) => out.push({ ...e, beat: b * p.meter + e.beatInBar, bar: b, index: out.length })))
  return out
}

/** Pulsos do trecho inteiro. */
export function patternBeats(p: RhythmPattern): number {
  return p.bars.length * p.meter
}

/** Ataques esperados (as notas, sem as pausas). */
export function onsets(p: RhythmPattern): PlacedEvent[] {
  return placed(p).filter((e) => !e.rest)
}

export function signature(p: RhythmPattern): string {
  return `${p.meter}:${p.bars.map((b) => barCells(b).join(',')).join('|')}`
}

export function durationOf(e: RhythmEvent): number {
  return FIGURE_BEATS[e.figure]
}

/**
 * Sorteia um trecho: `bars` compassos com as células da lição. Refaz (até
 * um limite) quando falta uma célula obrigatória, quando o trecho é igual
 * ao anterior ou quando só tem silêncio.
 */
export function makePattern(
  spec: CellSpec,
  meter: Meter,
  bars: number,
  rng: () => number = Math.random,
  avoid?: string,
): RhythmPattern {
  let best: RhythmPattern | null = null
  for (let tries = 0; tries < 80; tries++) {
    const p: RhythmPattern = { meter, bars: Array.from({ length: bars }, () => generateBar({ cells: spec.cells, focus: spec.focus }, rng, meter)) }
    const cells = p.bars.flatMap(barCells)
    const hasNote = p.bars.flat().some((e) => !e.rest)
    const hasMust = (spec.must ?? []).every((m) => cells.includes(m))
    best ??= p
    if (hasNote && hasMust && signature(p) !== avoid) return p
  }
  return best!
}
