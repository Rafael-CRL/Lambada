import { LESSON } from '../config'
import type { CellId, Meter } from '../domain/rhythm'
import type { RhythmBody, RhythmPart } from '../rhythm/items'
import { upDown, type LessonDef, type NotesBody, type ScoreBody, type TrailTopic, type UnitDef } from './lessons'

/**
 * Currículo. Teoria musical: notas e ritmo intercalados, do zero à leitura
 * de partitura no tempo. Violão: a primeira posição, corda por corda.
 * Os ids das lições de Suplementares vêm da trilha antiga (o progresso
 * guardado continua valendo); lições cortadas deixam o número vago.
 */

const STAFF = ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']
// o Mi da 1ª linha e o Mi do 4º espaço são a referência de onde se conta: ficam no padrão, não no sorteio
const BELOW = ['E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3']
const ABOVE = ['E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6']
const ALL = [...BELOW.slice(1).reverse(), ...STAFF, ...ABOVE.slice(2)]

// ---------------------------------------------------------------- atalhos

const notes = (pool: string[], parts: NotesBody['parts'], extra: Partial<NotesBody> = {}): NotesBody => ({ kind: 'notes', pool, parts, ...extra })
const intro = (...ids: string[]) => ({ kind: 'intro' as const, notes: ids })
/** a nota nova uma vez só, com o nome (nos botões, repetir seria copiar o nome) */
const introOnce = (...ids: string[]) => ({ kind: 'intro' as const, notes: ids, times: 1 })
const pattern = (seq: string[], names = false) => ({ kind: 'pattern' as const, seq, names })
const mix = (count: number) => ({ kind: 'mix' as const, count })
const bars = (list: string[][], names = false) => ({ kind: 'bars' as const, bars: list, names })

function rhythm(cells: CellId[], parts: RhythmPart[], extra: Partial<RhythmBody> = {}): RhythmBody {
  return { kind: 'rhythm', cells, parts, ...extra }
}
const rhythmChallenge = (cells: CellId[], meters: Meter[] = [4]): RhythmBody => rhythm(cells, [{ mode: 'read', count: 8 }], { meters, challenge: true })

function score(cells: CellId[], pool: string[], bpm: number, bars: number): ScoreBody {
  return { kind: 'score', input: 'buttons', content: 'random', cells, pool, bpm, bars }
}

/** Ids "unidade-N" pela posição; `n` fixa o número de uma lição que sobreviveu a um corte (o progresso guardado continua valendo). */
function lessonsOf(unit: string, list: (Omit<LessonDef, 'id' | 'unit'> & { n?: number })[]): LessonDef[] {
  return list.map(({ n, ...l }, i) => ({ ...l, id: `${unit}-${n ?? i + 1}`, unit }))
}

// ---------------------------------------------------------------- Teoria musical

const TEORIA: UnitDef[] = [
  {
    // linhas e espaços juntos, a partir de referências: o Sol da clave e depois o Dó do 3º espaço
    id: 'notas',
    topic: 'teoria',
    title: 'Notas na pauta',
    hint: 'do Sol da clave às 9 notas',
    practice: { activity: 'reading', options: { notes: 'pauta', accidentals: false } },
    lessons: lessonsOf('notas', [
      {
        title: 'Sol, Fá e Lá',
        cards: ['altura', 'pauta', 'linhaEspaco', 'clave', 'escala', 'passo'],
        segments: [notes(['F4', 'G4', 'A4'], [introOnce('G4', 'A4', 'F4'), pattern(['G4', 'A4', 'G4', 'F4', 'G4', 'A4', 'F4']), mix(12)])],
      },
      {
        title: 'Mi e Si',
        cards: ['mapa', 'pulo'],
        segments: [notes(['E4', 'F4', 'G4', 'A4', 'B4'], [introOnce('E4', 'B4'), pattern(['G4', 'E4', 'G4', 'B4', 'A4', 'F4', 'A4', 'B4', 'G4']), mix(12)])],
      },
      {
        title: 'Dó e Ré',
        cards: ['do'],
        segments: [notes(STAFF.slice(0, 7), [introOnce('C5', 'D5'), pattern(['G4', 'A4', 'B4', 'C5', 'A4', 'C5', 'D5', 'B4', 'C5']), mix(12)])],
      },
      {
        title: 'Mi e Fá de cima',
        cards: ['topo', 'escalaPauta'],
        segments: [notes(STAFF, [introOnce('E5', 'F5'), pattern(STAFF), mix(12)])],
      },
      { title: 'Desafio', challenge: true, segments: [notes(STAFF, [mix(LESSON.challengeNotes)], { noGuide: true })] },
    ]),
  },
  {
    id: 'figuras',
    topic: 'teoria',
    title: 'Pulso e figuras',
    hint: 'semínima, mínima, semibreve',
    practice: { activity: 'rhythm', options: { level: 2 } },
    lessons: lessonsOf('figuras', [
      {
        title: 'Pulso e semínima',
        cards: ['pulso', 'pe', 'seminima'],
        // só semínimas: um aquecimento curto para sentir o pulso e o gesto de bater (os trechos são todos iguais)
        segments: [rhythm(['q'], [{ mode: 'imitate', count: 1 }, { mode: 'read', count: 1 }])],
      },
      {
        title: 'Mínima',
        cards: ['minima'],
        segments: [
          rhythm(['q', 'h'], [{ mode: 'imitate', count: 3 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['h'], must: ['h'] }),
        ],
      },
      {
        title: 'Semibreve',
        cards: ['semibreve'],
        segments: [
          // "quantos pulsos" só aqui, com as três figuras juntas (antes seria repetir o cartão)
          rhythm(['q', 'h', 'w'], [{ mode: 'imitate', count: 2 }, { mode: 'read', count: 4 }, { mode: 'value', count: 3 }, { mode: 'write', count: 3 }], { focus: ['w'] }),
        ],
      },
      { title: 'Desafio', challenge: true, segments: [rhythmChallenge(['q', 'h', 'w'])] },
    ]),
  },
  {
    id: 'compasso',
    topic: 'teoria',
    title: 'Compasso',
    hint: 'barra, 4/4, 3/4, 2/4',
    practice: { activity: 'rhythm', options: { level: 2 } },
    lessons: lessonsOf('compasso', [
      {
        title: 'Barra de compasso',
        cards: ['compasso', 'tempoForte'],
        segments: [rhythm(['q', 'h', 'w'], [{ mode: 'read', count: 4 }, { mode: 'complete', count: 5 }, { mode: 'write', count: 3 }])],
      },
      {
        title: 'Três e dois por compasso',
        cards: ['formula', 'formulaBaixo', 'tres', 'dois'],
        // 2/4 sozinho, só com semínima e mínima, teria dois compassos possíveis: vai junto com o 3/4
        segments: [rhythm(['q', 'h'], [{ mode: 'imitate', count: 2 }, { mode: 'read', count: 5 }, { mode: 'complete', count: 4 }, { mode: 'write', count: 3 }], { meters: [3, 2, 3] })],
      },
      { n: 4, title: 'Desafio', challenge: true, segments: [rhythmChallenge(['q', 'h', 'w'], [4, 3, 2])] },
    ]),
  },
  {
    id: 'suplementares',
    topic: 'teoria',
    title: 'Suplementares',
    hint: 'abaixo e acima da pauta',
    review: STAFF,
    practice: { activity: 'reading', options: { notes: 'suplementares', accidentals: false } },
    lessons: lessonsOf('suplementares', [
      {
        title: 'Ré, Dó e Si',
        cards: ['suplementares', 'contarDaBorda'],
        segments: [notes(BELOW.slice(1, 4), [introOnce('D4', 'C4', 'B3'), pattern(upDown(BELOW.slice(0, 4))), mix(12)])],
      },
      { title: 'Até o Mi grave', segments: [notes(BELOW.slice(1), [introOnce('A3', 'G3', 'F3', 'E3'), pattern(BELOW), mix(12)])] },
      {
        title: 'Sol, Lá e Si',
        cards: ['suplementaresCima'],
        segments: [notes(ABOVE.slice(2, 5), [introOnce('G5', 'A5', 'B5'), pattern(upDown(ABOVE.slice(0, 5))), mix(12)])],
      },
      { title: 'Até o Mi agudo', segments: [notes(ABOVE.slice(2), [introOnce('C6', 'D6', 'E6'), pattern(ABOVE), mix(12)])] },
      {
        title: 'Desafio',
        challenge: true,
        cards: ['quatroMis'],
        // antes, os quatro Mis (grave, 1ª linha, 4º espaço, agudo): o mesmo nome, uma oitava de cada vez
        segments: [notes([...BELOW.slice(1), ...ABOVE.slice(2)], [pattern(upDown(['E3', 'E4', 'E5', 'E6']), true), mix(LESSON.challengeNotes)], { noGuide: true })],
      },
    ]),
  },
  {
    id: 'pausas',
    topic: 'teoria',
    title: 'Pausas',
    hint: 'o silêncio também conta',
    practice: { activity: 'rhythm', options: { level: 3 } },
    lessons: lessonsOf('pausas', [
      {
        title: 'Pausa de semínima',
        cards: ['pausa'],
        segments: [rhythm(['q', 'h', 'w', 'qr'], [{ mode: 'imitate', count: 3 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['qr'], must: ['qr'] })],
      },
      {
        title: 'Pausas de mínima e semibreve',
        cards: ['pausas', 'pausasLinha'],
        segments: [rhythm(['q', 'h', 'qr', 'hr', 'wr'], [{ mode: 'value', count: 5 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['hr', 'wr'] })],
      },
      { title: 'Desafio', challenge: true, segments: [rhythmChallenge(['q', 'h', 'w', 'qr', 'hr'], [4, 3])] },
    ]),
  },
  {
    id: 'colcheias',
    topic: 'teoria',
    title: 'Colcheias',
    hint: 'dois sons num pulso',
    practice: { activity: 'rhythm', options: { level: 4 } },
    lessons: lessonsOf('colcheias', [
      {
        title: 'Colcheia',
        cards: ['colcheia'],
        segments: [rhythm(['q', 'h', 'ee'], [{ mode: 'imitate', count: 3 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['ee'], must: ['ee'] })],
      },
      {
        title: 'Com pausas',
        segments: [rhythm(['q', 'h', 'ee', 'qr', 'hr'], [{ mode: 'imitate', count: 2 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['ee', 'qr'], meters: [4, 3] })],
      },
      { title: 'Desafio', challenge: true, segments: [rhythmChallenge(['q', 'h', 'w', 'ee', 'qr', 'hr'], [4, 3, 2])] },
    ]),
  },
  {
    id: 'ponto',
    topic: 'teoria',
    title: 'Ponto de aumento',
    hint: 'metade a mais',
    practice: { activity: 'rhythm', options: { level: 5 } },
    lessons: lessonsOf('ponto', [
      {
        title: 'Mínima pontuada',
        cards: ['ponto'],
        segments: [rhythm(['q', 'h', 'dh'], [{ mode: 'imitate', count: 3 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['dh'], must: ['dh'], meters: [3, 4] })],
      },
      {
        title: 'Semínima pontuada',
        cards: ['seminimaPontuada'],
        segments: [rhythm(['q', 'h', 'ee', 'dqe'], [{ mode: 'imitate', count: 3 }, { mode: 'read', count: 4 }, { mode: 'write', count: 3 }], { focus: ['dqe'], must: ['dqe'], meters: [4, 2] })],
      },
      { title: 'Desafio', challenge: true, segments: [rhythmChallenge(['q', 'h', 'w', 'dh', 'ee', 'dqe', 'qr'], [4, 3])] },
    ]),
  },
  {
    id: 'leitura',
    topic: 'teoria',
    title: 'Leitura de partitura',
    hint: 'notas e ritmo juntos',
    practice: { activity: 'reading', options: { notes: 'todas', tempo: 'metronome', accidentals: false } },
    lessons: lessonsOf('leitura', [
      { title: 'Mínimas e semibreves', cards: ['juntos', 'frente'], segments: [score(['h', 'w'], STAFF, 50, 4)] },
      { title: 'Com semínimas', segments: [score(['q', 'h', 'w'], STAFF, 50, 6)] },
      { title: 'Com pausas', segments: [score(['q', 'h', 'w', 'qr', 'hr'], STAFF, 56, 6)] },
      // as suplementares entram antes do Desafio, devagar (antes o Desafio saltava de 9 para 21 notas)
      { n: 5, title: 'Pela pauta toda', cards: ['todaPauta'], segments: [score(['q', 'h', 'w', 'qr', 'hr', 'dh'], ALL, 50, 6)] },
      { n: 4, title: 'Desafio', challenge: true, segments: [score(['q', 'h', 'w', 'qr', 'hr', 'dh'], ALL, 60, 8)] },
    ]),
  },
  {
    id: 'acidentes',
    topic: 'teoria',
    title: 'Acidentes',
    hint: '♯ ♭ ♮',
    practice: { activity: 'reading', options: { notes: 'pauta', accidentals: true } },
    lessons: lessonsOf('acidentes', [
      {
        title: 'Sustenido',
        cards: ['sustenido'],
        segments: [
          notes(['F4', 'F#4', 'C5', 'C#5', 'G4', 'G#4'], [introOnce('F#4', 'C#5'), pattern(['F4', 'F#4', 'G4', 'F#4', 'F4', 'C5', 'C#5', 'D5', 'C#5', 'C5']), mix(12)], {
            accidentals: true,
            noGuide: true,
            barEach: true,
          }),
        ],
      },
      {
        title: 'Bemol',
        cards: ['bemol', 'enarmonia'],
        segments: [
          notes(['B4', 'Bb4', 'E5', 'Eb5', 'A4', 'Ab4'], [introOnce('Bb4', 'Eb5'), pattern(['B4', 'Bb4', 'A4', 'Bb4', 'B4', 'E5', 'Eb5', 'D5', 'Eb5', 'E5']), mix(12)], {
            accidentals: true,
            noGuide: true,
            barEach: true,
          }),
        ],
      },
      {
        // o bequadro só tem função dentro de um compasso: o acidente vale até a barra, e o ♮ cancela antes dela
        title: 'Até a barra',
        cards: ['ateBarra', 'bequadro'],
        segments: [
          notes(
            ['F4', 'F#4', 'C5', 'C#5', 'B4', 'Bb4', 'E5', 'Eb5', 'D5', 'G4', 'A4'],
            [
              bars([['F#4', 'F4', 'G4'], ['F4']], true),
              bars([['C#5', 'C5', 'D5'], ['C5', 'C#5', 'C5♮'], ['Bb4', 'A4', 'B4'], ['B4'], ['F#4', 'F4', 'F4♮'], ['Eb5', 'E5', 'D5'], ['E5', 'Eb5', 'E5♮'], ['F#4', 'G4', 'F4']]),
            ],
            { accidentals: true, noGuide: true },
          ),
        ],
      },
      {
        title: 'Desafio',
        challenge: true,
        segments: [notes(['F4', 'F#4', 'G4', 'G#4', 'A4', 'Bb4', 'B4', 'C5', 'C#5', 'D5', 'Eb5', 'E5'], [mix(LESSON.challengeNotes)], { accidentals: true, noGuide: true, barEach: true })],
      },
    ]),
  },
]

// ---------------------------------------------------------------- Violão: primeira posição

/** Notas escritas de cada corda na 1ª posição (soam uma oitava abaixo). */
export const STRING_NOTES: Record<number, string[]> = {
  1: ['E5', 'F5', 'G5'],
  2: ['B4', 'C5', 'D5'],
  3: ['G4', 'A4'],
  4: ['D4', 'E4', 'F4'],
  5: ['A3', 'B3', 'C4'],
  6: ['E3', 'F3', 'G3'],
}

function stringLesson(n: number): Omit<LessonDef, 'id' | 'unit'> {
  const own = STRING_NOTES[n]
  const before = [1, 2, 3, 4, 5, 6].filter((s) => s < n).flatMap((s) => STRING_NOTES[s])
  const body = notes(own, [intro(...own), pattern(upDown(own)), mix(own.length > 2 ? 9 : 8)], { input: 'mic', review: before })
  // no tempo: cada nota da corda por um compasso, com o metrônomo
  const inTime: ScoreBody = { kind: 'score', input: 'mic', content: 'repeat', cells: ['q'], pool: own, bpm: 60, bars: own.length }
  return { title: `${n}ª corda`, cards: n === 1 ? ['corda1', 'dedos'] : [`corda${n}`], segments: [body, inTime] }
}

const VIOLAO: UnitDef[] = [
  {
    id: 'posicao',
    topic: 'violao',
    title: 'Primeira posição',
    hint: 'corda por corda, da 1ª à 6ª',
    practice: { activity: 'notes', options: {} },
    lessons: lessonsOf('posicao', [
      ...[1, 2, 3, 4, 5, 6].map(stringLesson),
      {
        title: 'Desafio',
        challenge: true,
        segments: [notes([1, 2, 3, 4, 5, 6].flatMap((s) => STRING_NOTES[s]), [mix(LESSON.challengeNotes)], { input: 'mic', noGuide: true })],
      },
    ]),
  },
]

// ---------------------------------------------------------------- consultas

export const UNITS: UnitDef[] = [...TEORIA, ...VIOLAO]
export const LESSONS: LessonDef[] = UNITS.flatMap((u) => u.lessons)

export function topicUnits(topic: TrailTopic): UnitDef[] {
  return UNITS.filter((u) => u.topic === topic)
}

export function lesson(id: string): LessonDef {
  return LESSONS.find((l) => l.id === id) ?? LESSONS[0]
}

export function isLessonId(s: string | undefined): s is string {
  return LESSONS.some((l) => l.id === s)
}

export function unitOf(id: string): UnitDef {
  const l = lesson(id)
  return UNITS.find((u) => u.id === l.unit)!
}

/** A lição seguinte na mesma trilha (a 1ª da unidade seguinte depois da última). */
export function nextLesson(id: string): LessonDef | null {
  const topic = unitOf(id).topic
  const list = topicUnits(topic).flatMap((u) => u.lessons)
  return list[list.findIndex((l) => l.id === id) + 1] ?? null
}

/** Notas que a lição de notas revisa: as da própria lição (violão) ou as da unidade. */
export function reviewFor(def: LessonDef, body: NotesBody): string[] {
  return body.review ?? UNITS.find((u) => u.id === def.unit)?.review ?? []
}
