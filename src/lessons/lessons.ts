import { LESSON } from '../config'
import { noteId, parseNote, type Note } from '../domain/notes'
import { staffStep } from '../domain/staff'
import { shuffle } from '../engine/picker'

/**
 * Trilha da Pauta: Linhas → Espaços → Suplementares, 5 lições cada. Cada
 * lição mostra onde ficam as notas novas (repetidas, com o nome), segue um
 * padrão (em ordem, com a cola fraca) e termina variando (sorteio, sem ajuda).
 * Um cartão separa as partes. A 5ª lição é o Desafio da etapa: sorteio sem
 * ajuda, com tempo. O sorteio revisa as etapas anteriores. Nada fica bloqueado.
 */

export type StageId = 'linhas' | 'espacos' | 'suplementares'
export type LessonId = `${StageId}-${1 | 2 | 3 | 4 | 5}`

type Part =
  /** cada nota nova repetida algumas vezes, com o nome e a cola */
  | { kind: 'intro'; notes: string[] }
  /** em ordem, sem o nome; `names` mostra o nome (demonstração) */
  | { kind: 'pattern'; seq: string[]; names?: boolean }
  /** sorteio entre as notas do `pool` (mais a revisão da etapa) */
  | { kind: 'mix'; count: number }

export interface LessonDef {
  id: LessonId
  stage: StageId
  title: string
  /** notas do sorteio */
  pool: string[]
  parts: Part[]
  /** sem a cola das linhas (lições "sem ajuda") */
  noGuide?: boolean
  /** Desafio da etapa: o sorteio tem tempo e conta para a etapa */
  challenge?: boolean
}

export interface StageDef {
  id: StageId
  title: string
  hint: string
  /** notas das etapas anteriores que voltam no sorteio */
  review: string[]
}

/** Sobe e volta, sem repetir o topo: [a, b, c] → a b c b a. */
export function upDown(notes: string[]): string[] {
  return [...notes, ...notes.slice(0, -1).reverse()]
}

const LINES = ['E4', 'G4', 'B4', 'D5', 'F5']
const SPACES = ['F4', 'A4', 'C5', 'E5']
const STAFF = ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']
// o Mi da 1ª linha e o Mi do 4º espaço são a referência de onde se conta: ficam no padrão, não no sorteio
const BELOW = ['E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3']
const ABOVE = ['E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6']

export const STAGES: StageDef[] = [
  { id: 'linhas', title: 'Linhas', hint: 'Mi Sol Si Ré Fá', review: [] },
  { id: 'espacos', title: 'Espaços', hint: 'Fá Lá Dó Mi', review: LINES },
  { id: 'suplementares', title: 'Suplementares', hint: 'abaixo e acima da pauta', review: STAFF },
]

export const LESSONS: LessonDef[] = [
  {
    id: 'linhas-1',
    stage: 'linhas',
    title: 'Mi e Sol',
    pool: ['E4', 'G4'],
    parts: [{ kind: 'intro', notes: ['E4', 'G4'] }, { kind: 'pattern', seq: ['E4', 'G4', 'E4', 'G4', 'E4'] }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'linhas-2',
    stage: 'linhas',
    title: 'Si',
    pool: ['E4', 'G4', 'B4'],
    parts: [{ kind: 'intro', notes: ['B4'] }, { kind: 'pattern', seq: upDown(['E4', 'G4', 'B4']) }, { kind: 'mix', count: 12 }],
  },
  {
    id: 'linhas-3',
    stage: 'linhas',
    title: 'Ré e Fá',
    pool: LINES,
    parts: [{ kind: 'intro', notes: ['D5', 'F5'] }, { kind: 'pattern', seq: upDown(LINES) }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'linhas-4',
    stage: 'linhas',
    title: 'Todas as linhas',
    pool: LINES,
    parts: [{ kind: 'pattern', seq: [...upDown(LINES), ...upDown([...LINES].reverse())] }, { kind: 'mix', count: 8 }],
  },
  {
    id: 'linhas-5',
    stage: 'linhas',
    title: 'Desafio',
    pool: LINES,
    noGuide: true,
    challenge: true,
    parts: [{ kind: 'mix', count: LESSON.challengeNotes }],
  },
  {
    id: 'espacos-1',
    stage: 'espacos',
    title: 'Fá e Lá',
    pool: ['F4', 'A4'],
    parts: [{ kind: 'intro', notes: ['F4', 'A4'] }, { kind: 'pattern', seq: ['F4', 'A4', 'F4', 'A4', 'F4'] }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'espacos-2',
    stage: 'espacos',
    title: 'Dó e Mi',
    pool: SPACES,
    parts: [{ kind: 'intro', notes: ['C5', 'E5'] }, { kind: 'pattern', seq: upDown(SPACES) }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'espacos-3',
    stage: 'espacos',
    title: 'Todos os espaços',
    pool: SPACES,
    parts: [{ kind: 'pattern', seq: [...upDown(SPACES), ...upDown([...SPACES].reverse())] }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'espacos-4',
    stage: 'espacos',
    title: 'Linhas e espaços',
    pool: STAFF,
    parts: [{ kind: 'pattern', seq: upDown(STAFF) }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'espacos-5',
    stage: 'espacos',
    title: 'Desafio',
    pool: STAFF,
    noGuide: true,
    challenge: true,
    parts: [{ kind: 'mix', count: LESSON.challengeNotes }],
  },
  {
    id: 'suplementares-1',
    stage: 'suplementares',
    title: 'Ré, Dó e Si',
    pool: BELOW.slice(1, 4),
    parts: [{ kind: 'intro', notes: ['D4', 'C4', 'B3'] }, { kind: 'pattern', seq: upDown(BELOW.slice(0, 4)) }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'suplementares-2',
    stage: 'suplementares',
    title: 'Até o Mi grave',
    pool: BELOW.slice(1),
    parts: [{ kind: 'intro', notes: ['A3', 'G3', 'F3', 'E3'] }, { kind: 'pattern', seq: BELOW }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'suplementares-3',
    stage: 'suplementares',
    title: 'Sol, Lá e Si',
    pool: ABOVE.slice(2, 5),
    parts: [{ kind: 'intro', notes: ['G5', 'A5', 'B5'] }, { kind: 'pattern', seq: upDown(ABOVE.slice(0, 5)) }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'suplementares-4',
    stage: 'suplementares',
    title: 'Até o Mi agudo',
    pool: ABOVE.slice(2),
    parts: [{ kind: 'intro', notes: ['C6', 'D6', 'E6'] }, { kind: 'pattern', seq: ABOVE }, { kind: 'mix', count: 10 }],
  },
  {
    id: 'suplementares-5',
    stage: 'suplementares',
    title: 'Desafio',
    pool: [...BELOW.slice(1), ...ABOVE.slice(2)],
    noGuide: true,
    challenge: true,
    // antes, os quatro Mis (grave, 1ª linha, 4º espaço, agudo): o mesmo nome, uma oitava de cada vez
    parts: [
      { kind: 'pattern', seq: upDown(['E3', 'E4', 'E5', 'E6']), names: true },
      { kind: 'mix', count: LESSON.challengeNotes },
    ],
  },
]

export function lesson(id: LessonId): LessonDef {
  return LESSONS.find((l) => l.id === id) ?? LESSONS[0]
}

export function isLessonId(s: string | undefined): s is LessonId {
  return LESSONS.some((l) => l.id === s)
}

export function stageLessons(stage: StageId): LessonDef[] {
  return LESSONS.filter((l) => l.stage === stage)
}

export function stageOf(id: LessonId): StageDef {
  return STAGES.find((s) => s.id === lesson(id).stage)!
}

/** A lição seguinte na trilha (a 1ª da etapa seguinte depois da 5ª). */
export function nextLesson(id: LessonId): LessonDef | null {
  return LESSONS[LESSONS.findIndex((l) => l.id === id) + 1] ?? null
}

/** Uma nota da lição, com as ajudas visíveis quando ela chega. */
export interface LessonStep {
  note: Note
  part: Part['kind']
  /** nome sob a nota */
  name: boolean
  /** opacidade da cola (0 = escondida) */
  guide: number
  /** primeira aparição de uma nota nova: diz onde ela fica */
  isNew?: boolean
  /** reaparição depois de um erro: a cola acende só esta nota */
  cue?: boolean
  /** Desafio: o tempo de resposta conta */
  timed?: boolean
  /** cartão antes desta nota (começo de uma parte); espera uma tecla */
  card?: LessonCard
}

export interface LessonCard {
  title: string
  detail?: string
}

/** Resultado de uma lição: acerto nas notas sem nome e, no Desafio, o tempo médio. */
export interface LessonResult {
  correct: number
  attempts: number
  /** segundos por nota (só no Desafio) */
  meanTime?: number
}

export function accuracyOf(r: LessonResult): number {
  return r.attempts ? r.correct / r.attempts : 1
}

/** "1,6 s" */
export function seconds(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} s`
}

/** Passou: acerto mínimo e, no Desafio, também o tempo por nota. */
export function passes(def: LessonDef, r: LessonResult): boolean {
  if (accuracyOf(r) < LESSON.pass) return false
  return !def.challenge || (r.meanTime ?? Infinity) <= LESSON.challengeTime
}

/**
 * Sorteio da parte final: saco embaralhado (todas saem antes de repetir).
 * Com 3 ou mais notas, nunca a mesma duas vezes seguidas; com 2, no máximo
 * duas seguidas (senão seria só alternar sem ler).
 */
export function mixSequence(pool: string[], count: number, rng: () => number = Math.random, before: string[] = []): string[] {
  const out: string[] = []
  let bag: string[] = []
  const recent = () => [...before, ...out]
  const blocked = (id: string) => {
    const r = recent()
    if (pool.length >= 3) return r.at(-1) === id
    return r.at(-1) === id && r.at(-2) === id
  }
  while (out.length < count) {
    if (bag.length === 0) bag = shuffle(pool, rng)
    const i = bag.findIndex((id) => !blocked(id))
    if (i >= 0) {
      out.push(bag.splice(i, 1)[0])
      continue
    }
    // o que sobrou no saco repetiria: puxa uma nota livre da próxima rodada
    const free = pool.filter((id) => !blocked(id))
    out.push(free.length ? free[Math.floor(rng() * free.length)] : bag.shift()!)
  }
  return out
}

/** Notas das etapas anteriores que entram no sorteio desta lição. */
export function reviewNotes(def: LessonDef): string[] {
  return STAGES.find((s) => s.id === def.stage)!.review.filter((id) => !def.pool.includes(id))
}

/**
 * Sorteio com revisão: `LESSON.review` das notas vêm das etapas anteriores,
 * espalhadas (nunca duas da revisão seguidas).
 */
export function mixSteps(def: LessonDef, count: number, rng: () => number = Math.random, before: string[] = []): LessonStep[] {
  const review = reviewNotes(def)
  const k = review.length ? Math.round(count * LESSON.review) : 0
  const ids = mixSequence(def.pool, count - k, rng, before)
  const gaps = shuffle(
    Array.from({ length: ids.length }, (_, i) => i + 1),
    rng,
  )
    .slice(0, k)
    .sort((a, b) => b - a)
  const extra = mixSequence(review, k, rng)
  gaps.forEach((g, i) => ids.splice(g, 0, extra[i]))
  return ids.map((id) => ({ note: parseNote(id), part: 'mix', name: false, guide: 0, timed: def.challenge }))
}

function cardFor(def: LessonDef, part: Part, first: boolean): LessonCard | undefined {
  if (part.kind === 'mix' && def.challenge)
    return { title: 'Desafio', detail: `${part.count} notas, sem ajuda, até ${LESSON.challengeTime} s por nota` }
  if (first) return undefined
  if (part.kind === 'pattern') return { title: 'agora em ordem', detail: 'subindo e descendo' }
  if (part.kind === 'mix') return { title: 'agora sozinho', detail: 'sem ajuda' }
  return undefined
}

/** Monta a sequência completa da lição. */
export function lessonSteps(def: LessonDef, rng: () => number = Math.random): LessonStep[] {
  const guide = def.noGuide ? 0 : 1
  const steps: LessonStep[] = []
  def.parts.forEach((part, i) => {
    const start = steps.length
    if (part.kind === 'intro') {
      const times = part.notes.length > 2 ? LESSON.introRepeatMany : LESSON.introRepeat
      for (const id of part.notes)
        for (let k = 0; k < times; k++) steps.push({ note: parseNote(id), part: 'intro', name: true, guide, isNew: k === 0 })
    } else if (part.kind === 'pattern') {
      for (const id of part.seq) steps.push({ note: parseNote(id), part: 'pattern', name: !!part.names, guide: guide * LESSON.patternGuide })
    } else {
      steps.push(...mixSteps(def, part.count, rng, steps.map((s) => noteId(s.note))))
    }
    const card = cardFor(def, part, i === 0)
    if (card && steps[start]) steps[start].card = card
  })
  return steps
}

/** Todas as notas da lição (para a cola), sem as da revisão. */
export function lessonNotes(def: LessonDef): Note[] {
  const ids = new Set<string>(def.pool)
  for (const p of def.parts) for (const id of p.kind === 'intro' ? p.notes : p.kind === 'pattern' ? p.seq : []) ids.add(id)
  return [...ids].map(parseNote).sort((a, b) => staffStep(a) - staffStep(b))
}

/** Onde a nota fica, em palavras: "2ª linha", "1º espaço", "1ª suplementar inferior". */
export function placeName(step: number): string {
  if (step >= 0 && step <= 8) return step % 2 === 0 ? `${step / 2 + 1}ª linha` : `${(step + 1) / 2}º espaço`
  if (step === -1) return 'logo abaixo da pauta'
  if (step === 9) return 'logo acima da pauta'
  if (step < 0) return step % 2 === 0 ? `${-step / 2}ª suplementar inferior` : `abaixo da ${(-step - 1) / 2}ª suplementar`
  return step % 2 === 0 ? `${(step - 8) / 2}ª suplementar superior` : `acima da ${(step - 9) / 2}ª suplementar`
}
