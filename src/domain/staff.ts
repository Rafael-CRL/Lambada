import { diatonicIndex, parseNote, type Note } from './notes'

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
