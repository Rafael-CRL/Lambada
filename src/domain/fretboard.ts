import { midiOf, parseNote } from './notes'

/** Corda 1 = Mi agudo, corda 6 = Mi grave. */
export type StringNum = 1 | 2 | 3 | 4 | 5 | 6

export interface Position {
  string: StringNum
  fret: number
}

export const STRING_NUMS: StringNum[] = [1, 2, 3, 4, 5, 6]

export const MAX_FRET = 12

/** Afinação padrão (notas soando). */
export const STANDARD_TUNING: Record<StringNum, number> = {
  1: midiOf(parseNote('E4')),
  2: midiOf(parseNote('B3')),
  3: midiOf(parseNote('G3')),
  4: midiOf(parseNote('D3')),
  5: midiOf(parseNote('A2')),
  6: midiOf(parseNote('E2')),
}

/** MIDI soando na posição. */
export function midiAt(pos: Position, tuning = STANDARD_TUNING): number {
  return tuning[pos.string] + pos.fret
}

/** Todas as posições (casas 0–maxFret) que produzem o MIDI soando. */
export function positionsOf(midi: number, maxFret = MAX_FRET, tuning = STANDARD_TUNING): Position[] {
  const out: Position[] = []
  for (const string of STRING_NUMS) {
    const fret = midi - tuning[string]
    if (fret >= 0 && fret <= maxFret) out.push({ string, fret })
  }
  return out
}

export function samePosition(a: Position, b: Position): boolean {
  return a.string === b.string && a.fret === b.fret
}

export function positionKey(p: Position): string {
  return `${p.string}:${p.fret}`
}

export const LOWEST_MIDI = STANDARD_TUNING[6]
export const HIGHEST_MIDI = STANDARD_TUNING[1] + MAX_FRET
