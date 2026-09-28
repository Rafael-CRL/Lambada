import { LESSON } from '../config'
import { noteId, parseNote, type Note } from '../domain/notes'
import type { CellId } from '../domain/rhythm'
import { staffStep } from '../domain/staff'
import { shuffle } from '../engine/picker'
import type { RhythmBody } from '../rhythm/items'

/**
 * Trilhas: unidades → lições → segmentos. Cada lição abre com cartões de
 * conceito (uma frase e um desenho) e segue com exercícios: notas na pauta
 * (pelo nome), ritmo (imitar, ler, escrever) ou partitura
 * no tempo (notas e ritmo juntos). A última lição de uma unidade costuma ser
 * o Desafio, que fecha a unidade. Nada fica bloqueado.
 */

type Part =
  /** cada nota nova repetida algumas vezes (ou `times`), com o nome e a cola */
  | { kind: 'intro'; notes: string[]; times?: number }
  /** em ordem, sem o nome; `names` mostra o nome (demonstração) */
  | { kind: 'pattern'; seq: string[]; names?: boolean }
  /** sorteio entre as notas do `pool` (mais a revisão da unidade) */
  | { kind: 'mix'; count: number }

/** Notas na pauta, uma de cada vez (semibreves em fila, sem compasso). */
export interface NotesBody {
  kind: 'notes'
  /** notas do sorteio (ids; "F4♮" mostra o bequadro) */
  pool: string[]
  parts: Part[]
  /** botões (padrão) ou microfone (violão) */
  input?: 'buttons' | 'mic'
  /** botões de ♯ e ♭ */
  accidentals?: boolean
  /** sem a cola das linhas */
  noGuide?: boolean
  /** notas revisadas no sorteio (padrão: as da unidade) */
  review?: string[]
}

/** Partitura no tempo: a Leitura (ou as Notas do violão) com o metrônomo. */
export interface ScoreBody {
  kind: 'score'
  input: 'buttons' | 'mic'
  /** sorteio com as figuras de `cells`, ou cada nota repetida por um compasso */
  content: 'random' | 'repeat'
  cells: CellId[]
  pool: string[]
  bpm: number
  bars: number
}

export type Segment = NotesBody | RhythmBody | ScoreBody

export type TrailTopic = 'teoria' | 'violao'

export interface LessonDef {
  id: string
  unit: string
  title: string
  /** cartões de conceito no começo (ids em CARDS) */
  cards?: string[]
  /** Desafio: fecha a unidade */
  challenge?: boolean
  segments: Segment[]
}

export interface UnitDef {
  id: string
  topic: TrailTopic
  title: string
  hint: string
  /** notas de unidades anteriores que voltam no sorteio */
  review?: string[]
  lessons: LessonDef[]
}

/** Sobe e volta, sem repetir o topo: [a, b, c] → a b c b a. */
export function upDown(notes: string[]): string[] {
  return [...notes, ...notes.slice(0, -1).reverse()]
}

/** Nota da lição: "F4♮" é o Fá com o bequadro à vista. */
export function lessonNote(id: string): { note: Note; natural: boolean } {
  const natural = id.endsWith('♮')
  return { note: parseNote(natural ? id.slice(0, -1) : id), natural }
}

/** Uma nota da lição, com as ajudas visíveis quando ela chega. */
export interface LessonStep {
  note: Note
  /** mostra o ♮ */
  natural?: boolean
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

/** Resultado: acerto (nas notas sem nome, nos trechos e perguntas) e, no Desafio de notas, o tempo médio. */
export interface LessonResult {
  correct: number
  attempts: number
  /** segundos por nota (só no Desafio de notas) */
  meanTime?: number
}

export function accuracyOf(r: LessonResult): number {
  return r.attempts ? r.correct / r.attempts : 1
}

/** "1,6 s" */
export function seconds(t: number): string {
  return `${t.toFixed(1).replace('.', ',')} s`
}

/** Tempo máximo por nota no Desafio (o violão tem mais folga). */
export function challengeTime(def: LessonDef): number | null {
  const notes = def.segments.find((s): s is NotesBody => s.kind === 'notes')
  if (!def.challenge || !notes) return null
  return notes.input === 'mic' ? LESSON.challengeTimeMic : LESSON.challengeTime
}

/** Passou: acerto mínimo e, no Desafio de notas, também o tempo por nota. */
export function passes(def: LessonDef, r: LessonResult): boolean {
  if (accuracyOf(r) < LESSON.pass) return false
  const limit = challengeTime(def)
  return limit === null || (r.meanTime ?? Infinity) <= limit
}

// ---------------------------------------------------------------- sorteio

/**
 * Saco embaralhado (todas saem antes de repetir). Com 3 ou mais notas,
 * nunca a mesma duas vezes seguidas; com 2, no máximo duas seguidas
 * (senão seria só alternar sem ler).
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

/** A lição de notas com o que ela precisa saber da unidade. */
export interface NotesLesson {
  body: NotesBody
  challenge?: boolean
  /** notas de unidades anteriores (as do sorteio ficam de fora) */
  review?: string[]
}

export function reviewNotes(l: NotesLesson): string[] {
  const base = new Set(l.body.pool.map((id) => noteId(lessonNote(id).note)))
  return (l.review ?? []).filter((id) => !base.has(id))
}

/**
 * Sorteio com revisão: `LESSON.review` das notas vêm das unidades
 * anteriores, espalhadas (nunca duas da revisão seguidas).
 */
export function mixSteps(l: NotesLesson, count: number, rng: () => number = Math.random, before: string[] = []): LessonStep[] {
  const review = reviewNotes(l)
  const k = review.length ? Math.round(count * LESSON.review) : 0
  const ids = mixSequence(l.body.pool, count - k, rng, before)
  const gaps = shuffle(
    Array.from({ length: ids.length }, (_, i) => i + 1),
    rng,
  )
    .slice(0, k)
    .sort((a, b) => b - a)
  const extra = mixSequence(review, k, rng)
  gaps.forEach((g, i) => ids.splice(g, 0, extra[i]))
  return ids.map((id) => ({ ...lessonNote(id), part: 'mix', name: false, guide: 0, timed: l.challenge }))
}

function cardFor(l: NotesLesson, part: Part, first: boolean): LessonCard | undefined {
  if (part.kind === 'mix' && l.challenge) {
    const limit = l.body.input === 'mic' ? LESSON.challengeTimeMic : LESSON.challengeTime
    return { title: 'Desafio', detail: `${part.count} notas, sem ajuda, até ${limit} s por nota` }
  }
  if (first) return undefined
  if (part.kind === 'pattern') return { title: 'agora em ordem', detail: 'subindo e descendo' }
  if (part.kind === 'mix') return { title: 'agora sozinho', detail: 'sem ajuda' }
  return undefined
}

/** Monta a sequência completa da lição de notas. */
export function lessonSteps(l: NotesLesson, rng: () => number = Math.random): LessonStep[] {
  const guide = l.body.noGuide ? 0 : 1
  const steps: LessonStep[] = []
  l.body.parts.forEach((part, i) => {
    const start = steps.length
    if (part.kind === 'intro') {
      const times = part.times ?? (part.notes.length > 2 ? LESSON.introRepeatMany : LESSON.introRepeat)
      for (const id of part.notes)
        for (let k = 0; k < times; k++) steps.push({ ...lessonNote(id), part: 'intro', name: true, guide, isNew: k === 0 })
    } else if (part.kind === 'pattern') {
      for (const id of part.seq) steps.push({ ...lessonNote(id), part: 'pattern', name: !!part.names, guide: guide * LESSON.patternGuide })
    } else {
      steps.push(...mixSteps(l, part.count, rng, steps.map((s) => noteId(s.note))))
    }
    const card = cardFor(l, part, i === 0)
    if (card && steps[start]) steps[start].card = card
  })
  return steps
}

/** Todas as notas da lição (para a cola), sem as da revisão. */
export function lessonNotes(body: NotesBody): Note[] {
  const ids = new Set<string>(body.pool)
  for (const p of body.parts) for (const id of p.kind === 'intro' ? p.notes : p.kind === 'pattern' ? p.seq : []) ids.add(id)
  const notes = new Map<string, Note>()
  for (const id of ids) {
    const n = lessonNote(id).note
    notes.set(noteId(n), n)
  }
  return [...notes.values()].sort((a, b) => staffStep(a) - staffStep(b))
}

/** Onde a nota fica, em palavras: "2ª linha", "1º espaço", "1ª suplementar inferior". */
export function placeName(step: number): string {
  if (step >= 0 && step <= 8) return step % 2 === 0 ? `${step / 2 + 1}ª linha` : `${(step + 1) / 2}º espaço`
  if (step === -1) return 'logo abaixo da pauta'
  if (step === 9) return 'logo acima da pauta'
  if (step < 0) return step % 2 === 0 ? `${-step / 2}ª suplementar inferior` : `abaixo da ${(-step - 1) / 2}ª suplementar`
  return step % 2 === 0 ? `${(step - 8) / 2}ª suplementar superior` : `acima da ${(step - 9) / 2}ª suplementar`
}
