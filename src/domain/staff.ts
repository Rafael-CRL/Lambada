import { STANDARD_TUNING } from './fretboard'
import { defaultSpelling, diatonicIndex, LETTERS, parseNote, writtenFromSounding, type Note } from './notes'

/**
 * Geometria abstrata da pauta em clave de sol. "Passo" = meio espaço;
 * passo 0 = primeira linha (Mi4 escrito), passo 8 = quinta linha (Fá5).
 */

const BOTTOM_LINE = diatonicIndex(parseNote('E4'))

export const STAFF_TOP_STEP = 8
export const MIDDLE_LINE_STEP = 4

/** Âmbito escrito suportado: Mi3 a Mi6. */
export const WRITTEN_MIN = parseNote('E3')
export const WRITTEN_MAX = parseNote('E6')

export function staffStep(n: Note): number {
  return diatonicIndex(n) - BOTTOM_LINE
}

/** Passos (pares) das linhas suplementares necessárias para a nota. */
export function ledgerSteps(step: number): number[] {
  const out: number[] = []
  for (let s = -2; s >= step; s -= 2) out.push(s)
  for (let s = STAFF_TOP_STEP + 2; s <= step; s += 2) out.push(s)
  return out
}

/** Haste para cima abaixo da linha do meio, para baixo a partir dela. */
export function stemUp(step: number): boolean {
  return step < MIDDLE_LINE_STEP
}

export function inStaffRange(n: Note): boolean {
  const s = staffStep(n)
  return s >= staffStep(WRITTEN_MIN) && s <= staffStep(WRITTEN_MAX)
}

/**
 * Naturais escritas do Mi grave solto até a nota da 1ª corda na casa
 * `maxFret`, calculadas pela afinação (casa 12 → Mi6, casa 19 → Si6).
 */
export function guitarRangeNaturals(maxFret: number): Note[] {
  const low = writtenFromSounding(defaultSpelling(STANDARD_TUNING[6]))
  const high = writtenFromSounding(defaultSpelling(STANDARD_TUNING[1] + maxFret))
  const out: Note[] = []
  for (let octave = low.octave; octave <= high.octave; octave++) {
    for (const letter of LETTERS) {
      const n: Note = { letter, acc: 0, octave }
      if (staffStep(n) >= staffStep(low) && staffStep(n) <= staffStep(high)) out.push(n)
    }
  }
  return out
}
