import { STANDARD_TUNING, type Position, type StringNum } from '../domain/fretboard'
import { midiOf, parseNote } from '../domain/notes'
import { FIGURE_BEATS, type Figure } from '../domain/rhythm'

/** Notas escritas (o violão soa uma oitava abaixo). Vozes preservam a duração do baixo. */
export interface WrittenNote {
  note: string | null
  beat: number
  figure: Figure
  voice?: 'bass' | 'upper'
  natural?: boolean
  position?: Position
  finger?: string
}
export interface Study {
  id: string
  title: string
  group: string
  kind: 'exercise' | 'piece'
  page: number
  meter: number
  /** Exemplos de localização não têm fórmula de compasso no livro. */
  unmetered?: boolean
  bars: WrittenNote[][]
  /** Índices dos compassos, já com ritornelos e D.C. resolvidos. */
  order: number[]
  polyphonic?: boolean
  hint: string
  form?: string
  author?: string
}

export const GROUPS = [
  { id: 'graves', title: '1. Cordas graves', pages: '26–27', hint: 'Polegar nas cordas 6, 5 e 4. Em cada corda: repetição, pares e mudanças de nota.' },
  { id: 'arpejos', title: '2. Exercícios combinados', pages: '28', hint: 'O baixo continua soando enquanto os dedos tocam as cordas agudas.' },
  { id: 'agudas', title: '3. Cordas agudas', pages: '29–31', hint: 'Alterne indicador e médio. 3ª corda: Sol–Lá; 2ª: Si–Dó–Ré; 1ª: Mi–Fá–Sol.' },
  { id: 'alteracoes', title: '4. Notas alteradas', pages: '31–33', hint: '♯ sobe uma casa; ♭ desce uma casa; ♮ desfaz a alteração. Os números indicam as casas sugeridas.' },
  { id: 'repertorio', title: '5. Primeiras peças', pages: '34', hint: 'Junte baixo e melodia. Escolha a peça e pratique no seu andamento.' },
] as const

const figures: Record<string, Figure> = { q: 'quarter', h: 'half', w: 'whole', e: 'eighth', dh: 'dotted-half' }

/** Transcrição compacta: altura:figura; ! explicita o bequadro; r = pausa. */
function line(text: string, string?: StringNum, voice?: WrittenNote['voice']): WrittenNote[] {
  let beat = 0
  return text.split(' ').map((token) => {
    const [raw, f = 'q'] = token.split(':')
    const note = raw === 'r' ? null : raw.replace('!', '')
    const figure = figures[f]
    if (!figure) throw new Error(`Figura inválida: ${f}`)
    const position = note && string ? { string, fret: midiOf(parseNote(note)) - 12 - STANDARD_TUNING[string] } : undefined
    const out: WrittenNote = { note, beat, figure, voice, natural: raw.includes('!'), position }
    beat += FIGURE_BEATS[figure]
    return out
  })
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const twice = (n: number) => [...range(n), ...range(n)]
const studies: Study[] = []

// pp. 26–27 e 29–30: cada linha é uma prática independente, com seu ritornelo.
for (const string of [6, 5, 4, 3, 2, 1] as StringNum[]) {
  const notes = ({ 6: ['E3', 'F3', 'G3'], 5: ['A3', 'B3', 'C4'], 4: ['D4', 'E4', 'F4'], 3: ['G4', 'A4'], 2: ['B4', 'C5', 'D5'], 1: ['E5', 'F5', 'G5'] })[string]
  const patterns = string === 3
    ? ['0000|1111|0000|1111', '0011|0011|0101', '0101|0011|0101|0011']
    : ['0000|1111|2222|1111', '0022|1122|0022|1122', `0121|0212|0102|${string >= 4 ? '1210' : '0201'}`]
  patterns.forEach((pattern, v) => {
    const bars = pattern.split('|').map((p) => line([...p].map((n) => notes[Number(n)]).join(' '), string))
    const n = bars.length
    bars.push(line(`${notes[0]}:w`, string))
    for (const bar of bars) bar.forEach((e, i) => { e.finger = string >= 4 ? 'p' : i % 2 ? 'm' : 'i' })
    studies.push({
      id: `corda-${string}-${v + 1}`, title: `${string}ª corda · ${['notas repetidas', 'notas em pares', 'mudanças de nota'][v]}`,
      kind: 'exercise', group: string >= 4 ? 'graves' : 'agudas', page: string >= 5 ? 26 : string === 4 ? 27 : string === 3 ? 29 : 30,
      meter: 4, bars, order: [...twice(n), n], form: 'Repita o trecho duas vezes e termine na nota longa.',
      hint: string >= 4 ? 'Toque com o polegar. Mantenha o pulso nas mudanças de casa.' : 'Alterne i–m; apoie o polegar na 6ª corda. Os dedos são uma orientação para sua prática.',
    })
  })
}

function addLines(id: string, title: string, group: string, page: number, text: string, hint: string, repeat = false) {
  const bars = text.split('|').map((b) => line(b.trim()))
  studies.push({ id, title, group, page, hint, kind: 'exercise', meter: 4, bars, order: repeat ? twice(bars.length) : range(bars.length), form: repeat ? 'Toque os 16 compassos e repita desde o começo.' : undefined })
}
addLines('graves-combinadas', '6ª, 5ª e 4ª cordas · combinadas', 'graves', 27,
  'E3 G3 F3 A3 | G3 B3 A3 C4 | B3 D4 C4 E4 | D4 F4 E4 D4 | C4 B3 A3 G3 | F3 E3 F3 G3 | F3 E3 E3:h',
  'Use o polegar e antecipe a troca de corda, sem interromper o pulso.')
addLines('agudas-combinadas', '3ª, 2ª e 1ª cordas · combinadas', 'agudas', 31,
  'G4 G4 A4 B4 | C5:h B4:h | C5 C5 D5 E5 | C5:h G4:h | G4 G4 A4 B4 | C5 D5 E5 F5 | G5 F5 E5 D5 | C5:h r:h | C5 G4 C5 E5 | G5 G5 F5 E5 | D5 F5 E5 D5 | C5:h G4:h | C5 G4 C5 E5 | G5 G5 F5 E5 | D5 F5 E5 D5 | C5:h r:h',
  'Observe as mínimas e as pausas. Alterne os dedos e mantenha as trocas entre cordas regulares.', true)

function arpeggio(bass: string, upper: string[], meter: number): WrittenNote[] {
  const low = line(`${bass}:${meter === 3 ? 'dh' : 'h'}`, undefined, 'bass')[0]
  low.finger = 'p'
  const high = upper.map((note, i): WrittenNote => ({ note, beat: (i + 1) / 2, figure: 'eighth', voice: 'upper' }))
  return [low, ...high]
}
for (const variant of [1, 2]) {
  const bass = variant === 1
    ? ['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'B3', 'A3', 'G3', 'F3']
    : ['F4', 'E4', 'D4', 'C4', 'E4', 'D4', 'C4', 'B3', 'A3', 'C4', 'B3', 'A3', 'C4', 'B3', 'A3', 'G3', 'B3', 'A3', 'G3', 'F3', 'E3', 'F3', 'G3', 'F3']
  const bars = bass.map((b) => arpeggio(b, variant === 1 ? ['G4', 'B4', 'E5'] : ['B4', 'G4', 'E5'], 2))
  bars.forEach((b) => b.slice(1).forEach((e, i) => { e.finger = (variant === 1 ? ['i', 'm', 'a'] : ['m', 'i', 'a'])[i] }))
  const n = bars.length
  bars.push(line('E3:h', undefined, 'bass'))
  studies.push({ id: `arpejo-${variant}`, title: variant === 1 ? 'Arpejo p–i–m–a' : 'Arpejo p–m–i–a', group: 'arpejos', kind: 'exercise', page: 28, meter: 2, bars,
    order: variant === 1 ? [...twice(n), n] : range(n + 1), polyphonic: true,
    form: variant === 1 ? 'Repita os dez compassos antes do Mi final.' : undefined,
    hint: 'Sustente o baixo por dois pulsos. As três notas agudas entram entre os pulsos, em colcheias.' })
}

// pp. 32–33: exemplos por corda, sem compasso impresso. A unidade de prática é a semínima.
const sharp: Record<StringNum, string> = { 6: 'E3 F3 F#3 G3 G#3', 5: 'A3 A#3 B3 C4 C#4', 4: 'D4 D#4 E4 F4 F#4', 3: 'G4 G#4 A4 A#4', 2: 'B4 C5 C#5 D5 D#5', 1: 'E5 F5 F#5 G5 G#5' }
const flat: Record<StringNum, string> = { 1: 'Ab5 G5 Gb5 F5 E5', 2: 'Eb5 D5 Db5 C5 B4', 3: 'Bb4 A4 Ab4 G4', 4: 'Gb4 F4 E4 Eb4 D4', 5: 'Db4 C4 B3 Bb3 A3', 6: 'Ab3 G3 Gb3 F3 E3' }
const cancelSharp: Record<StringNum, string> = { 6: 'F3 F#3 F3! G3 G#3 G3!', 5: 'A3 A#3 A3! C4 C#4 C4!', 4: 'D4 D#4 D4! F4 F#4 F4!', 3: 'G4 G#4 G4! A4 A#4 A4!', 2: 'C5 C#5 C5! D5 D#5 D5!', 1: 'F5 F#5 F5! G5 G#5 G5!' }
const cancelFlat: Record<StringNum, string> = { 1: 'G5 Gb5 G5! F5 Fb5 F5!', 2: 'D5 Db5 D5! C5 Cb5 C5!', 3: 'B4 Bb4 B4! A4 Ab4 A4!', 4: 'F4 Fb4 F4! E4 Eb4 E4!', 5: 'C4 Cb4 C4! B3 Bb3 B3!', 6: 'G3 Gb3 G3! F3 Fb3 F3!' }
for (const [id, title, data, page, strings] of [
  ['sustenidos', 'Sustenidos', sharp, 32, [6, 5, 4, 3, 2, 1]],
  ['bemois', 'Bemóis', flat, 32, [1, 2, 3, 4, 5, 6]],
  ['bequadro-sustenido', 'Bequadro após ♯', cancelSharp, 33, [6, 5, 4, 3, 2, 1]],
  ['bequadro-bemol', 'Bequadro após ♭', cancelFlat, 33, [1, 2, 3, 4, 5, 6]],
] as const) {
  for (const string of strings) {
    const notes = line(data[string], string)
    notes.forEach((e, i) => { e.finger = string >= 4 ? 'p' : i % 2 ? 'm' : 'i' })
    studies.push({ id: `${id}-${string}`, title: `${title} · ${string}ª corda`, group: 'alteracoes', kind: 'exercise', page,
      meter: notes.length, unmetered: true, bars: [notes], order: [0],
      hint: id.startsWith('bequadro') ? 'A nota com ♮ volta à altura natural. Confira a casa indicada para manter a mesma corda.' : 'Percorra as casas indicadas na mesma corda. Cada nota vale um pulso; o exemplo do livro não tem compasso.' })
  }
}

const andante = [
  arpeggio('A3', ['A4', 'B4', 'C5', 'B4', 'A4'], 3),
  arpeggio('D4', ['D5', 'E5', 'F5', 'E5', 'D5'], 3),
  arpeggio('E3', ['B4', 'C5', 'D5', 'C5', 'B4'], 3),
  arpeggio('A3', ['D5', 'E5', 'F5', 'E5', 'D5'], 3),
  arpeggio('A3', ['A4', 'B4', 'C5', 'B4', 'A4'], 3),
  arpeggio('D4', ['D5', 'E5', 'F5', 'E5', 'D5'], 3),
  arpeggio('E3', ['B4', 'D5', 'C5', 'B4', 'C5'], 3),
  [...line('A3:dh', undefined, 'bass'), ...line('A4:dh', undefined, 'upper')],
]
andante.forEach((b) => b.filter((e) => e.voice === 'upper').forEach((e, i) => { e.finger = i % 2 ? 'm' : 'i' }))
studies.push({ id: 'andante', title: 'Andante', group: 'repertorio', kind: 'piece', page: 34, meter: 3, bars: andante, order: twice(8), polyphonic: true,
  hint: 'Sustente o baixo por três pulsos e mantenha as colcheias regulares. No último compasso, baixo e melodia começam juntos.', form: 'Oito compassos, com repetição.' })

// Poco Andante: A A B B A (D.C. al Fine, sem repetir novamente o primeiro ritornelo).
const pocoBass = ['E4', 'F4', 'G4', 'A4', 'G4', 'F4', 'E4', 'C4', 'D4', 'E4', 'F4', 'G4', 'E4', 'F4', 'D4', 'E4']
const pocoUpper = ['C5', 'D5', 'E5', 'F5', 'E5', 'D5', 'C5', null, 'B4', 'C5', 'D5', 'E5', 'C5', 'D5', 'B4', 'C5']
for (const meter of [2, 3]) {
  const bars = pocoBass.map((bass, i) => [
    ...line(`${bass}:${meter === 2 ? 'h' : 'dh'}`, undefined, 'bass'),
    ...line(pocoUpper[i] ? `r ${pocoUpper[i]}${meter === 3 ? ` ${pocoUpper[i]}` : ''}` : `r:${meter === 2 ? 'h' : 'dh'}`, undefined, 'upper'),
  ])
  studies.push({ id: `poco-andante-${meter}`, title: `Poco Andante · ${meter}/4`, author: 'N. Coste', group: 'repertorio', kind: 'piece', page: 34, meter, bars,
    order: [...twice(8), ...twice(8).map((i) => i + 8), ...range(8)], polyphonic: true,
    hint: meter === 2 ? 'O polegar inicia o compasso; a melodia entra no segundo pulso. Deixe o baixo soar.' : 'Variação em três pulsos: baixo no primeiro, melodia no segundo e no terceiro.',
    form: 'A → A → B → B → A. Na volta ao início, termine no Fine (compasso 8).' })
}

// Ordenação estável: mesma sequência de assuntos e páginas do livro.
export const STUDIES: Study[] = GROUPS.flatMap((g) => studies.filter((s) => s.group === g.id))
export function studyById(id: string): Study | undefined { return STUDIES.find((s) => s.id === id) }

export interface TimelineNote extends WrittenNote { at: number; end: number; bar: number; visit: number; key: string }
export function timeline(study: Study): TimelineNote[] {
  return study.order.flatMap((bar, visit) => study.bars[bar].map((note, index) => ({
    ...note, at: visit * study.meter + note.beat, end: visit * study.meter + note.beat + FIGURE_BEATS[note.figure], bar, visit, key: `${bar}-${index}`,
  }))).sort((a, b) => a.at - b.at)
}
