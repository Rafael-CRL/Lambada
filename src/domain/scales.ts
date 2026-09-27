import { positionsOf, type Position, type StringNum } from './fretboard'
import {
  defaultSpelling,
  isAllowedSpelling,
  LETTERS,
  midiOf,
  noteId,
  parseNote,
  writtenFromSounding,
  type Accidental,
  type Note,
} from './notes'

export type ScaleId = 'solta' | 'fechada'

export const SCALE_LABELS: Record<ScaleId, string> = {
  solta: 'Solta',
  fechada: 'Fechada',
}

interface ScaleSpec {
  /** Janela de casas usada para derivar os acidentes. */
  window: [number, number]
  /** Posições fixas fora da janela (ex.: Mi grave solto na Fechada). */
  extra: Position[]
  /** Notas naturais: [corda, nota soando, casa]. */
  naturals: [StringNum, string, number][]
}

const SPECS: Record<ScaleId, ScaleSpec> = {
  solta: {
    window: [0, 4],
    extra: [],
    naturals: [
      [6, 'E2', 0], [6, 'F2', 1], [6, 'G2', 3],
      [5, 'A2', 0], [5, 'B2', 2], [5, 'C3', 3],
      [4, 'D3', 0], [4, 'E3', 2], [4, 'F3', 3],
      [3, 'G3', 0], [3, 'A3', 2],
      [2, 'B3', 0], [2, 'C4', 1], [2, 'D4', 3],
      [1, 'E4', 0], [1, 'F4', 1], [1, 'G4', 3],
    ],
  },
  fechada: {
    window: [1, 5],
    extra: [{ string: 6, fret: 0 }],
    naturals: [
      [6, 'E2', 0], [6, 'F2', 1], [6, 'G2', 3], [6, 'A2', 5],
      [5, 'B2', 2], [5, 'C3', 3], [5, 'D3', 5],
      [4, 'E3', 2], [4, 'F3', 3], [4, 'G3', 5],
      [3, 'A3', 2], [3, 'B3', 4],
      [2, 'C4', 1], [2, 'D4', 3], [2, 'E4', 5],
      [1, 'F4', 1], [1, 'G4', 3],
    ],
  },
}

/** Uma nota da escala: pitch soando + posição no braço. */
export interface ScaleNote {
  /** MIDI soando */
  midi: number
  position: Position
  natural: boolean
}

/**
 * Item de estudo: uma grafia escrita. Acidentes geram dois itens (♯ e ♭)
 * que compartilham o mesmo pitch e a mesma posição.
 */
export interface StudyItem {
  /** id da nota escrita, ex.: "C#5" */
  id: string
  written: Note
  sounding: Note
  midi: number
  position: Position
  natural: boolean
}

function naturalsOf(scale: ScaleId): ScaleNote[] {
  return SPECS[scale].naturals.map(([string, id, fret]) => ({
    midi: midiOf(parseNote(id)),
    position: { string, fret },
    natural: true,
  }))
}

function inWindow(scale: ScaleId, p: Position): boolean {
  const spec = SPECS[scale]
  const [lo, hi] = spec.window
  if (p.fret >= lo && p.fret <= hi) return true
  return spec.extra.some((e) => e.string === p.string && e.fret === p.fret)
}

/**
 * Deriva a posição de um acidente pelo modelo do braço: uma casa dentro da
 * janela, preferindo a corda das naturais vizinhas.
 */
export function deriveAccidentalPosition(scale: ScaleId, midi: number): Position {
  const naturals = naturalsOf(scale)
  const candidates = positionsOf(midi).filter((p) => inWindow(scale, p))
  if (candidates.length === 0) throw new Error(`sem posição para MIDI ${midi} na escala ${scale}`)
  const lower = naturals.find((n) => n.midi === midi - 1)
  const upper = naturals.find((n) => n.midi === midi + 1)
  const neighbourStrings = [lower?.position.string, upper?.position.string]
  for (const s of neighbourStrings) {
    const hit = candidates.find((c) => c.string === s)
    if (hit) return hit
  }
  return candidates[0]
}

/** Notas da escala em ordem de altura. */
export function scaleNotes(scale: ScaleId, accidentals: boolean): ScaleNote[] {
  const naturals = naturalsOf(scale)
  if (!accidentals) return naturals
  const lo = naturals[0].midi
  const hi = naturals[naturals.length - 1].midi
  const out: ScaleNote[] = []
  for (let midi = lo; midi <= hi; midi++) {
    const nat = naturals.find((n) => n.midi === midi)
    out.push(nat ?? { midi, position: deriveAccidentalPosition(scale, midi), natural: false })
  }
  return out
}

function spellingsForScale(midi: number): Note[] {
  const base = defaultSpelling(midi)
  if (base.acc === 0) return [base]
  // sustenido da letra de baixo e bemol da letra de cima
  const sharp = base
  const nextLetter = LETTERS[(LETTERS.indexOf(sharp.letter) + 1) % 7]
  const flat: Note = { letter: nextLetter, acc: -1 as Accidental, octave: nextLetter === 'C' ? sharp.octave + 1 : sharp.octave }
  return [sharp, flat].filter((n) => isAllowedSpelling(n.letter, n.acc) && midiOf(n) === midi)
}

/** Itens de estudo da escala, em ordem de altura (♯ antes do ♭ no mesmo pitch). */
export function scaleItems(scale: ScaleId, accidentals: boolean): StudyItem[] {
  const items: StudyItem[] = []
  for (const sn of scaleNotes(scale, accidentals)) {
    for (const sounding of spellingsForScale(sn.midi)) {
      const written = writtenFromSounding(sounding)
      items.push({
        id: noteId(written),
        written,
        sounding,
        midi: sn.midi,
        position: sn.position,
        natural: sn.natural,
      })
    }
  }
  return items
}

/**
 * Ordem de desbloqueio: corda 1 → corda 6, casa crescente dentro da corda.
 * Começa pelas notas agudas, mais próximas do centro da pauta.
 */
export function unlockOrder(items: StudyItem[]): StudyItem[] {
  return [...items].sort(
    (a, b) => a.position.string - b.position.string || a.position.fret - b.position.fret || b.written.acc - a.written.acc,
  )
}

/**
 * Sequência ascendente + descendente (sem repetir o topo). Como na escrita
 * cromática usual, sobe com sustenidos e desce com bemóis.
 */
export function scaleSequence(items: StudyItem[]): StudyItem[] {
  const up = items.filter((i) => i.written.acc >= 0).sort((a, b) => a.midi - b.midi)
  const down = items.filter((i) => i.written.acc <= 0).sort((a, b) => b.midi - a.midi)
  return [...up, ...down.slice(1)]
}

export function positionOfMidiInScale(scale: ScaleId, midi: number, accidentals: boolean): Position | null {
  return scaleNotes(scale, accidentals).find((n) => n.midi === midi)?.position ?? null
}

/**
 * Posição para mostrar um pitch tocado: a da escala, se existir; senão a
 * mais próxima da região da escala.
 */
export function displayPosition(scale: ScaleId, midi: number, accidentals: boolean): Position | null {
  const inScale = positionOfMidiInScale(scale, midi, true) ?? positionOfMidiInScale(scale, midi, accidentals)
  if (inScale) return inScale
  const [lo, hi] = SPECS[scale].window
  const center = (lo + hi) / 2
  const all = positionsOf(midi)
  if (!all.length) return null
  return all.reduce((best, p) => (Math.abs(p.fret - center) < Math.abs(best.fret - center) ? p : best))
}
