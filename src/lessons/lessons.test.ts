import { describe, expect, test } from 'vitest'
import { LESSON } from '../config'
import { noteId, parseNote } from '../domain/notes'
import { inStaffRange, staffStep } from '../domain/staff'
import { rhythmItems } from '../rhythm/items'
import { CARDS } from './cards'
import { GUIDES } from './guides'
import { LESSONS, lesson, nextLesson, reviewFor, topicUnits, UNITS, unitOf } from './curriculum'
import {
  barSteps,
  lessonNote,
  lessonSteps,
  mixSequence,
  passes,
  placeName,
  reviewNotes,
  type LessonDef,
  type NotesBody,
  type NotesLesson,
} from './lessons'

/** rng determinístico (LCG) */
function seeded(seed = 1) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
}

const ids = (xs: { note: Parameters<typeof noteId>[0] }[]) => xs.map((x) => noteId(x.note))
const notesOf = (def: LessonDef): NotesBody => def.segments.find((s): s is NotesBody => s.kind === 'notes')!
const asLesson = (id: string): NotesLesson => {
  const def = lesson(id)
  const body = notesOf(def)
  return { body, challenge: def.challenge, review: reviewFor(def, body) }
}

describe('currículo', () => {
  test('Teoria: 9 unidades, notas e ritmo intercalados', () => {
    expect(topicUnits('teoria').map((u) => u.id)).toEqual(['notas', 'figuras', 'compasso', 'suplementares', 'pausas', 'colcheias', 'ponto', 'leitura', 'acidentes'])
  })

  test('Violão: a primeira posição, corda por corda, com Desafio', () => {
    const u = topicUnits('violao')[0]
    expect(u.lessons.map((l) => l.title)).toEqual(['1ª corda', '2ª corda', '3ª corda', '4ª corda', '5ª corda', '6ª corda', 'Desafio'])
  })

  test('ids únicos; os da trilha antiga continuam (o progresso vale)', () => {
    const all = LESSONS.map((l) => l.id)
    expect(new Set(all).size).toBe(all.length)
    for (let i = 1; i <= 5; i++) expect(all).toContain(`suplementares-${i}`)
  })

  test('todo guia é de uma unidade que existe', () => {
    for (const id of Object.keys(GUIDES)) expect(UNITS.some((u) => u.id === id), id).toBe(true)
  })

  test('todo cartão citado existe', () => {
    for (const l of LESSONS) for (const c of l.cards ?? []) expect(CARDS[c], `${l.id}: ${c}`).toBeDefined()
  })

  test('todas as notas cabem na pauta; acidentes só na unidade de acidentes', () => {
    for (const l of LESSONS)
      for (const s of l.segments) {
        if (s.kind === 'rhythm') continue
        for (const id of s.pool) {
          const n = lessonNote(id).note
          expect(inStaffRange(n), `${l.id}: ${id}`).toBe(true)
          if (l.unit !== 'acidentes') expect(n.acc, `${l.id}: ${id}`).toBe(0)
        }
      }
  })

  test('todo trecho de ritmo se gera, e "complete o compasso" tem opções', () => {
    for (const l of LESSONS)
      for (const s of l.segments) {
        if (s.kind !== 'rhythm') continue
        for (let seed = 1; seed < 6; seed++) {
          const items = rhythmItems(s, seeded(seed))
          expect(items.length, l.id).toBeGreaterThan(0)
          for (const it of items) if (it.mode === 'complete') expect(it.options.length).toBeGreaterThanOrEqual(2)
        }
      }
  })

  test('a próxima lição segue a trilha, atravessando as unidades', () => {
    expect(nextLesson('notas-4')?.id).toBe('notas-5')
    expect(nextLesson('notas-5')?.id).toBe('figuras-1')
    expect(nextLesson('acidentes-4')).toBeNull()
    expect(nextLesson('posicao-1')?.id).toBe('posicao-2')
    expect(unitOf('notas-2').title).toBe('Notas na pauta')
  })

  test('toda unidade com Desafio o tem como última lição', () => {
    for (const u of UNITS) {
      const i = u.lessons.findIndex((l) => l.challenge)
      if (i >= 0) expect(i).toBe(u.lessons.length - 1)
    }
  })

  test('uma lição de notas tem umas 20 notas', () => {
    for (const l of LESSONS) {
      const body = l.segments.find((s): s is NotesBody => s.kind === 'notes')
      if (!body) continue
      const n = lessonSteps({ body, challenge: l.challenge, review: reviewFor(l, body) }, seeded()).length
      expect(n, l.id).toBeGreaterThanOrEqual(10)
      expect(n, l.id).toBeLessThanOrEqual(30)
    }
  })
})

describe('sequência da lição de notas', () => {
  test('a pauta começa pelo Sol da clave e os vizinhos, uma vez, com o nome e a cola', () => {
    const steps = lessonSteps(asLesson('notas-1'), seeded())
    const intro = steps.filter((s) => s.part === 'intro')
    expect(ids(intro)).toEqual(['G4', 'A4', 'F4'])
    expect(intro.every((s) => s.name && s.guide === 1)).toBe(true)
  })

  test('depois o padrão (cola fraca) e o sorteio (sem ajuda), com cartão em cada parte', () => {
    const steps = lessonSteps(asLesson('notas-4'), seeded())
    const pattern = steps.filter((s) => s.part === 'pattern')
    expect(ids(pattern)).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'])
    expect(pattern.every((s) => !s.name && s.guide === LESSON.patternGuide)).toBe(true)
    // o sorteio começa com a cola fraca, apagando, e segue sem ela
    const mix = steps.filter((s) => s.part === 'mix')
    const fade = mix.slice(0, LESSON.fadeNotes).map((s) => s.guide)
    expect(fade[0]).toBeLessThan(LESSON.patternGuide)
    for (let i = 1; i < fade.length; i++) expect(fade[i]).toBeLessThan(fade[i - 1])
    expect(mix.slice(LESSON.fadeNotes).every((s) => !s.name && s.guide === 0)).toBe(true)
    expect(steps.filter((s) => s.card).map((s) => s.card!.title)).toEqual(['agora em ordem', 'agora sozinho'])
  })

  test('Desafio: sorteio sem cola, com tempo e cartão logo no começo', () => {
    const steps = lessonSteps(asLesson('notas-5'), seeded())
    expect(steps).toHaveLength(LESSON.challengeNotes)
    expect(steps.every((s) => s.guide === 0 && s.timed)).toBe(true)
    expect(steps[0].card?.title).toBe('Desafio')
  })

  test('suplementares: o Mi da 1ª linha é referência (no padrão, fora do sorteio)', () => {
    expect(notesOf(lesson('suplementares-1')).pool).not.toContain('E4')
    expect(ids(lessonSteps(asLesson('suplementares-2'), seeded()).filter((s) => s.part === 'pattern'))).toEqual(['E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3'])
    for (const id of ['suplementares-3', 'suplementares-4']) {
      expect(notesOf(lesson(id)).pool).not.toContain('E5')
      expect(notesOf(lesson(id)).pool).not.toContain('F5')
    }
  })

  test('o sorteio revisa as unidades anteriores, espalhado', () => {
    expect(reviewNotes(asLesson('notas-2'))).toEqual([])
    const review = reviewNotes(asLesson('suplementares-1'))
    expect(review).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'])
    for (let seed = 1; seed < 20; seed++) {
      const mix = ids(lessonSteps(asLesson('suplementares-1'), seeded(seed)).filter((s) => s.part === 'mix'))
      const isReview = mix.map((id) => review.includes(id))
      expect(isReview.filter(Boolean)).toHaveLength(Math.round(10 * LESSON.review))
      for (let i = 1; i < mix.length; i++) expect(isReview[i] && isReview[i - 1]).toBe(false)
    }
  })

  test('violão: cada corda revisa as anteriores', () => {
    expect(asLesson('posicao-1').review).toEqual([])
    expect(asLesson('posicao-3').review).toEqual(['E5', 'F5', 'G5', 'B4', 'C5', 'D5'])
  })

  test('acidente vale até a barra: a nota sem sinal herda; o ♮ e a barra desfazem', () => {
    const steps = barSteps([['F#4', 'F4', 'F4♮', 'F4'], ['F4']], false)
    expect(steps.map((s) => noteId(s.note))).toEqual(['F#4', 'F#4', 'F4', 'F4', 'F4'])
    // a herdada é desenhada sem o sinal; o ♮ aparece; a barra abre o 2º compasso
    expect(steps[1].shown && noteId(steps[1].shown)).toBe('F4')
    expect(steps[2].natural).toBe(true)
    expect(steps.map((s) => !!s.barStart)).toEqual([false, false, false, false, true])
    // outra oitava não herda
    expect(barSteps([['F#4', 'F5']], false).map((s) => noteId(s.note))).toEqual(['F#4', 'F5'])
  })

  test('a lição "Até a barra" usa compassos, e as notas herdadas contam pelo que valem', () => {
    const steps = lessonSteps(asLesson('acidentes-3'), seeded())
    expect(steps.filter((s) => s.shown).length).toBeGreaterThan(3)
    expect(steps.filter((s) => s.card).map((s) => s.card!.title)).toEqual(['agora você'])
  })
})

describe('respostas', () => {
  test('passar: acerto mínimo; no Desafio de notas também o tempo (violão com mais folga)', () => {
    const d = lesson('notas-5')
    expect(passes(d, { correct: 19, attempts: 20, meanTime: 1.5 })).toBe(true)
    expect(passes(d, { correct: 19, attempts: 20, meanTime: 2.5 })).toBe(false)
    expect(passes(d, { correct: 15, attempts: 20, meanTime: 1 })).toBe(false)
    expect(passes(lesson('notas-1'), { correct: 19, attempts: 20 })).toBe(true)
    expect(passes(lesson('posicao-7'), { correct: 19, attempts: 20, meanTime: 2.5 })).toBe(true)
    // Desafio de ritmo: só o acerto
    expect(passes(lesson('figuras-4'), { correct: 19, attempts: 20 })).toBe(true)
  })
})

describe('sorteio', () => {
  test('com 3 ou mais notas, nunca a mesma duas vezes seguidas', () => {
    for (let seed = 1; seed < 30; seed++) {
      const seq = mixSequence(['E4', 'G4', 'B4'], 30, seeded(seed), ['B4'])
      expect(seq[0]).not.toBe('B4')
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
    }
  })

  test('com 2 notas, no máximo duas seguidas (e não só alternando)', () => {
    let repeats = 0
    for (let seed = 1; seed < 30; seed++) {
      const seq = mixSequence(['E4', 'G4'], 20, seeded(seed))
      for (let i = 2; i < seq.length; i++) expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false)
      for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) repeats++
    }
    expect(repeats).toBeGreaterThan(0)
  })

  test('todas as notas saem antes de repetir', () => {
    const pool = ['E4', 'G4', 'B4', 'D5', 'F5']
    expect([...mixSequence(pool, 5, seeded(7))].sort()).toEqual([...pool].sort())
  })
})

test('nome do lugar de cada nota', () => {
  const place = (id: string) => placeName(staffStep(parseNote(id)))
  expect(place('E4')).toBe('1ª linha')
  expect(place('F4')).toBe('1º espaço')
  expect(place('D4')).toBe('logo abaixo da pauta')
  expect(place('C4')).toBe('1ª suplementar inferior')
  expect(place('B3')).toBe('abaixo da 1ª suplementar')
  expect(place('A5')).toBe('1ª suplementar superior')
  expect(place('E6')).toBe('3ª suplementar superior')
})
