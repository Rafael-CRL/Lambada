/**
 * Notas soletradas (letra + acidente + oitava) em notação científica.
 * Oitava 4 contém o Dó central (C4 = MIDI 60).
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

/** -1 = bemol, 0 = natural, 1 = sustenido */
export type Accidental = -1 | 0 | 1

export interface Note {
  letter: Letter
  acc: Accidental
  octave: number
}

const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const LETTER_NAMES_PT: Record<Letter, string> = {
  C: 'Dó',
  D: 'Ré',
  E: 'Mi',
  F: 'Fá',
  G: 'Sol',
  A: 'Lá',
  B: 'Si',
}

/** Grafias excluídas do app: Mi♯, Si♯, Dó♭ e Fá♭. */
export function isAllowedSpelling(letter: Letter, acc: Accidental): boolean {
  if (acc === 1) return letter !== 'E' && letter !== 'B'
  if (acc === -1) return letter !== 'C' && letter !== 'F'
  return true
}

export function note(letter: Letter, acc: Accidental, octave: number): Note {
  return { letter, acc, octave }
}

export function midiOf(n: Note): number {
  return 12 * (n.octave + 1) + LETTER_PC[n.letter] + n.acc
}

/** Índice diatônico absoluto (C0 = 0, D0 = 1, ...). Base do posicionamento na pauta. */
export function diatonicIndex(n: Note): number {
  return n.octave * 7 + LETTERS.indexOf(n.letter)
}

const ACC_SUFFIX: Record<Accidental, string> = { [-1]: 'b', 0: '', 1: '#' }

/** Identificador estável: "C4", "F#3", "Bb2". */
export function noteId(n: Note): string {
  return `${n.letter}${ACC_SUFFIX[n.acc]}${n.octave}`
}

export function parseNote(id: string): Note {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(id)
  if (!m) throw new Error(`nota inválida: ${id}`)
  const acc: Accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return { letter: m[1] as Letter, acc, octave: Number(m[3]) }
}

/** Identificador da classe (sem oitava): "C#", "Db". Usado pelos botões. */
export function spellingId(n: Pick<Note, 'letter' | 'acc'>): string {
  return `${n.letter}${ACC_SUFFIX[n.acc]}`
}

const ACC_SYMBOL: Record<Accidental, string> = { [-1]: '♭', 0: '', 1: '♯' }

/** Nome em português: "Dó♯". */
export function namePt(n: Pick<Note, 'letter' | 'acc'>): string {
  return `${LETTER_NAMES_PT[n.letter]}${ACC_SYMBOL[n.acc]}`
}

/** Nome com oitava: "Dó♯4". */
export function namePtOctave(n: Note): string {
  return `${namePt(n)}${n.octave}`
}

export function sameNote(a: Note, b: Note): boolean {
  return a.letter === b.letter && a.acc === b.acc && a.octave === b.octave
}

export function sameSpelling(a: Pick<Note, 'letter' | 'acc'>, b: Pick<Note, 'letter' | 'acc'>): boolean {
  return a.letter === b.letter && a.acc === b.acc
}

/**
 * Grafias possíveis para um número MIDI, respeitando as exclusões.
 * Natural quando existe; senão [sustenido, bemol].
 */
export function spellingsOf(midi: number): Note[] {
  const out: Note[] = []
  for (const letter of LETTERS) {
    for (const acc of [0, 1, -1] as Accidental[]) {
      if (!isAllowedSpelling(letter, acc)) continue
      const pc = LETTER_PC[letter] + acc
      // oitava tal que a nota caia no MIDI pedido (acidentes podem cruzar a oitava, ex.: B#)
      const octave = Math.floor((midi - pc) / 12) - 1
      const n = { letter, acc, octave }
      if (midiOf(n) === midi) out.push(n)
    }
  }
  const natural = out.find((n) => n.acc === 0)
  if (natural) return [natural]
  return out.sort((a, b) => b.acc - a.acc)
}

/** Grafia preferida para exibição de um pitch detectado (natural ou sustenido). */
export function defaultSpelling(midi: number): Note {
  return spellingsOf(midi)[0]
}

export function transpose(n: Note, octaves: number): Note {
  return { ...n, octave: n.octave + octaves }
}

/**
 * Violão é transpositor: escreve-se uma oitava acima do que soa.
 */
export function writtenFromSounding(n: Note): Note {
  return transpose(n, 1)
}

export function soundingFromWritten(n: Note): Note {
  return transpose(n, -1)
}

export function writtenMidiFromSoundingMidi(midi: number): number {
  return midi + 12
}

export function freqToMidiFloat(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4)
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

export type PitchMatch = 'correct' | 'wrong-octave' | 'wrong'

/**
 * Compara um pitch (em MIDI escrito) com a nota esperada (escrita).
 * Qualquer enarmônico conta; a oitava tem de ser exata.
 */
export function matchPitch(expectedWritten: Note, playedWrittenMidi: number): PitchMatch {
  const expected = midiOf(expectedWritten)
  if (expected === playedWrittenMidi) return 'correct'
  if ((((expected - playedWrittenMidi) % 12) + 12) % 12 === 0) return 'wrong-octave'
  return 'wrong'
}

/** Com botões só a grafia exata conta; oitava não se aplica. */
export function matchButton(expected: Pick<Note, 'letter' | 'acc'>, pressed: Pick<Note, 'letter' | 'acc'>): boolean {
  return sameSpelling(expected, pressed)
}
